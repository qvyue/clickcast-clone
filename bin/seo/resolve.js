/**
 * URL → Meta Resolver
 * Maps request paths to SEO meta objects.
 * Static pages use config; blog posts query Supabase.
 */

const { SITE_URL, staticMeta } = require('./meta');
const { getAdminClient } = require('../utils/supabase-admin');

/**
 * Resolve a request path to an SEO meta object.
 *
 * @param {string} path - Request path (e.g. '/', '/blog/ai-video-generator-comparison-...')
 * @returns {Promise<object|null>} Meta object with title, description, ogType, canonical, etc.
 *          Returns null if the path should not get custom meta (fallback to default).
 *          Returns { __status: 404 } for paths that should respond with 404.
 */
async function resolveMeta(path) {
  // Normalize trailing slash
  const normalized = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;

  // Static pages
  if (staticMeta[normalized]) {
    return {
      ...staticMeta[normalized],
      canonical: `${SITE_URL}${normalized}`,
    };
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

  // Unrecognized paths — soft 404
  return { __status: 404, ...staticMeta['/'], canonical: `${SITE_URL}/` };
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
      .select('id, title, slug, excerpt, cover_image_url, author, published_at')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return { __status: 404, ...staticMeta['/'], canonical: `${SITE_URL}/` };
    }

    const meta = {
      title: `${data.title} — VidGen Blog`,
      description: data.excerpt || data.title,
      ogType: 'article',
      canonical: `${SITE_URL}/blog/${data.slug}`,
    };

    if (data.cover_image_url) {
      meta.ogImage = data.cover_image_url;
    }

    // Article structured data
    meta.jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: data.title,
      description: data.excerpt || undefined,
      image: data.cover_image_url || undefined,
      author: { '@type': 'Person', name: data.author || 'VidGen Team' },
      datePublished: data.published_at || undefined,
      publisher: {
        '@type': 'Organization',
        name: 'VidGen',
        url: SITE_URL,
      },
    };

    return meta;
  } catch (err) {
    console.error('[seo/resolve] Blog meta query failed:', err.message);
    return null;
  }
}

module.exports = { resolveMeta };
