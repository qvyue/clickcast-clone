/**
 * URL → Meta Resolver
 * Maps request paths to SEO meta objects.
 * Static pages use config; blog posts query Supabase.
 */

const { SITE_URL, staticMeta, OG_IMAGE_URL, webApplicationSchema, howToSchema } = require('./meta');
const { getAdminClient } = require('../utils/supabase-admin');

/**
 * Resolve a request path to an SEO meta object.
 *
 * @param {string} path - Request path (e.g. '/', '/blog/ai-video-generator-comparison-...')
 * @returns {Promise<object|null>} Meta object with title, description, ogType, canonical, etc.
 *          Returns null if the path should not get custom meta (fallback to default).
 *          Returns { __status: 404 } for paths that should respond with 404.
 */
async function resolveMeta(path, { prefetchedFaqs } = {}) {
  // Normalize trailing slash
  const normalized = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;

  // Static pages
  if (staticMeta[normalized]) {
    const meta = {
      ...staticMeta[normalized],
      canonical: `${SITE_URL}${normalized}`,
    };

    // Homepage: build dynamic JSON-LD (FAQPage + WebApplication + HowTo)
    if (normalized === '/') {
      meta.jsonLd = await buildHomepageJsonLd(prefetchedFaqs);
    }

    return meta;
  }

  // Blog detail: /blog/:slug
  const blogMatch = normalized.match(/^\/blog\/([a-z0-9-]+)$/);
  if (blogMatch) {
    return await resolveBlogMeta(blogMatch[1]);
  }

  // Known non-indexable paths — still serve SPA but no custom meta needed
  if (
    normalized.startsWith('/editor/') ||
    normalized.startsWith('/dashboard') ||
    normalized.startsWith('/admin') ||
    normalized.startsWith('/auth/')
  ) {
    return null;
  }

  // Unrecognized paths — soft 404 with distinct meta (not homepage's)
  return {
    __status: 404,
    title: 'Page Not Found — VidGen',
    description: 'The page you are looking for does not exist.',
    ogType: 'website',
    ogImage: OG_IMAGE_URL,
    // No canonical for 404 pages — prevents Google from treating them as the homepage
  };
}

/**
 * Resolve meta for a blog post by slug.
 */
async function resolveBlogMeta(slug) {
  const supabase = getAdminClient();
  if (!supabase) {
    return null; // DB not configured, skip meta injection
  }

  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image_url, author, published_at, updated_at')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return {
        __status: 404,
        title: 'Page Not Found — VidGen',
        description: 'The page you are looking for does not exist.',
        ogType: 'website',
        ogImage: OG_IMAGE_URL,
      };
    }

    const meta = {
      title: `${data.title} — VidGen Blog`,
      description: data.excerpt || data.title,
      ogType: 'article',
      canonical: `${SITE_URL}/blog/${data.slug}`,
      ogImage: data.cover_image_url || OG_IMAGE_URL,
    };

    // Article structured data
    meta.jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: data.title,
      description: data.excerpt || undefined,
      image: data.cover_image_url || OG_IMAGE_URL,
      author: { '@type': 'Person', name: data.author || 'VidGen Team' },
      datePublished: data.published_at || undefined,
      dateModified: data.updated_at || undefined,
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${data.slug}` },
      publisher: {
        '@type': 'Organization',
        name: 'VidGen',
        url: SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: OG_IMAGE_URL,
        },
      },
    };

    return meta;
  } catch (err) {
    console.error('[seo/resolve] Blog meta query failed:', err.message);
    return null;
  }
}

/**
 * Check if a URL path should be pre-rendered for bots.
 * @param {string} path
 * @returns {boolean}
 */
function isPrerenderablePath(path) {
  const normalized = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;

  // Static public pages
  if (staticMeta[normalized]) return true;

  // Blog posts
  if (normalized.match(/^\/blog\/[a-z0-9-]+$/)) return true;

  return false;
}

/**
 * Build the homepage JSON-LD @graph combining WebApplication, HowTo, and FAQPage schemas.
 * FAQPage data is queried from Supabase.
 */
async function buildHomepageJsonLd(prefetchedFaqs) {
  const graph = [webApplicationSchema, howToSchema];

  // Use prefetched FAQs if available (avoids double Supabase query)
  let faqs = prefetchedFaqs;
  if (!faqs) {
    const supabase = getAdminClient();
    if (supabase) {
      try {
        const { data } = await supabase
          .from('faqs')
          .select('question, answer')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        faqs = data;
      } catch (err) {
        console.error('[seo/resolve] FAQ query failed:', err.message);
      }
    }
  }

  if (faqs && faqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.answer.replace(/\s+/g, ' ').trim(),
        },
      })),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

module.exports = { resolveMeta, isPrerenderablePath };
