/**
 * Server-Side Rendering for Core Pages
 *
 * Renders blog posts, blog listing, and homepage content directly in Express,
 * without Playwright. All visitors (including AI tools, unknown crawlers,
 * and users without JavaScript) see the content.
 *
 * React hydrates and replaces the SSR HTML on the client side.
 */

const { marked } = require('marked');
const { getAdminClient } = require('../utils/supabase-admin');

// ========== Blog Post ==========

/**
 * Render a blog post page as HTML.
 * @param {string} slug
 * @returns {Promise<string|null>} HTML for <div id="root">, or null if not found
 */
async function renderBlogPost(slug) {
  const supabase = getAdminClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('title, slug, content, excerpt, cover_image_url, category, author, read_time, published_at')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;

    const date = data.published_at
      ? new Date(data.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';

    const contentHtml = marked(data.content);

    return `<div class="blogpost-page"><div class="blogpost-container"><div class="blogpost-header"><h1 class="blogpost-title">${esc(data.title)}</h1><div class="blogpost-meta">${data.category ? `<span class="blogpost-category-badge">${esc(data.category)}</span>` : ''}${date ? `<span>${esc(date)}</span>` : ''}<span>${data.read_time || 5} min read</span>${data.author ? `<span>${esc(data.author)}</span>` : ''}</div></div><div class="blogpost-content">${contentHtml}</div></div></div>`;
  } catch (err) {
    console.error('[ssr] renderBlogPost failed:', err.message);
    return null;
  }
}

// ========== Blog Listing ==========

/**
 * Render the blog listing page as HTML.
 * @returns {Promise<string|null>} HTML for <div id="root">, or null on failure
 */
async function renderBlogList() {
  const supabase = getAdminClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image_url, category, author, read_time, published_at')
      .eq('is_active', true)
      .order('published_at', { ascending: false });

    if (error) return null;

    const posts = data || [];
    const cardsHtml = posts.map((p) => {
      const date = p.published_at
        ? new Date(p.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : '';
      return `<div class="blog-card"><h2 class="blog-card-title"><a href="/blog/${esc(p.slug)}">${esc(p.title)}</a></h2>${p.excerpt ? `<p class="blog-card-excerpt">${esc(p.excerpt)}</p>` : ''}<div class="blog-card-meta">${p.category ? `<span class="blog-card-category">${esc(p.category)}</span>` : ''}${date ? `<span>${esc(date)}</span>` : ''}<span>${p.read_time || 5} min read</span></div></div>`;
    }).join('');

    return `<div class="blog-page"><div class="blog-hero"><h1 class="blog-hero-title">Our Blog</h1><p class="blog-hero-subtitle">Insights, guides, and tips on creating stunning videos from your website.</p></div><div class="blog-container"><div class="blog-grid">${cardsHtml}</div></div></div>`;
  } catch (err) {
    console.error('[ssr] renderBlogList failed:', err.message);
    return null;
  }
}

// ========== Homepage ==========

/**
 * Render the homepage as HTML with dynamic FAQ data.
 * @returns {Promise<{html: string, faqs?: object[]}|null>} SSR result, or null on failure
 */
async function renderHomepage() {
  // Fetch FAQ data
  let faqHtml = '';
  let faqs = null;
  const supabase = getAdminClient();
  if (supabase) {
    try {
      const { data: faqs } = await supabase
        .from('faqs')
        .select('question, answer')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (faqs && faqs.length > 0) {
        // Store raw FAQ data for JSON-LD reuse (avoid double Supabase query)
        const items = faqs.map((f, i) =>
          `<div class="faq-item${i === 0 ? ' open' : ''}"><button class="faq-q"><span>${esc(f.question)}</span></button><div class="faq-a-wrapper"><p class="faq-a">${esc(f.answer)}</p></div></div>`
        ).join('');
        faqHtml = `<section id="faq" class="faq-section"><div class="section-container"><div class="section-header-center"><h2 class="section-title">Common <span class="text-muted">Questions</span></h2></div><div class="faq-list">${items}</div></div></section>`;
      }
    } catch (_) { /* FAQ is optional */ }
  }

  const homeHtml = `<div class="home-container"><header class="hero-section"><div class="hero-glow"></div><div class="hero-content"><h1 class="hero-title">Paste your URL,<br>Get <span class="text-gradient">website video</span><br>in minutes</h1><p class="hero-subtitle">Transform any website into a professional marketing video instantly. No recording, no editing. Skip the hassle of hiring freelancers or spending days creating videos yourself.</p></div></header><section id="workflow" class="workflow-section"><div class="section-container"><div class="section-header-center"><h2 class="section-title">Workflow <span class="text-muted">Simplified</span></h2><p class="section-desc">From URL to render in three simple steps.</p></div><div class="workflow-grid"><div class="workflow-card"><div class="workflow-step-num">1</div><h3>Paste your URL</h3><p>Input any valid website address. Our system connects to your live site to capture assets.</p></div><div class="workflow-card"><div class="workflow-step-num">2</div><h3>AI Analyzes &amp; Plans</h3><p>Our agent extracts text and visual hierarchy, then writes a structured script and plans scenes.</p></div><div class="workflow-card"><div class="workflow-step-num">3</div><h3>Cinematic Video</h3><p>Remotion orchestrates screenshots, voiceovers, and dynamic text into a ready-to-use marketing video.</p></div></div></div></section><section class="why-section"><div class="section-container why-container"><div class="why-header"><h2 class="section-title">Why <span class="text-gradient">VidGen</span>?</h2><p class="why-desc">Creating marketing or launch videos is time-consuming and expensive. You either spend tens of thousands on agencies or waste hours learning complex video editors.<br><br>VidGen solves this by offering an instant, highly customizable video engine. We enforce strict narrative alignment between subtitles and voiceovers, delivering a polished video automatically.</p></div><div class="comparison-card"><div class="comp-col old-way"><h3>Traditional Way</h3><ul><li>Manual recording</li><li>Days of video editing</li><li>Expensive voice actors</li><li>Slow iterations</li></ul></div><div class="comp-col new-way"><h3>With VidGen</h3><ul><li>1-click URL generation</li><li>Instant AI scripting</li><li>Realistic AI Voices</li><li>Edit in browser</li></ul></div></div></div></section><section id="use-cases" class="built-for-section"><div class="section-container"><div class="section-header-center"><h2 class="section-title">Built for <span class="text-muted">Builders</span></h2></div><div class="builders-grid"><div class="builder-card"><h3>SaaS Founders</h3><p>Launch your product with a professional website video before you even have a marketing team.</p></div><div class="builder-card"><h3>Indie Hackers</h3><p>Stop spending days editing videos. Ship your features, paste your URL, and get back to coding.</p></div><div class="builder-card"><h3>Marketing Teams</h3><p>A/B test different video styles and messaging instantly without blocking the design team.</p></div><div class="builder-card"><h3>Students</h3><p>Showcase your projects and assignments with cinematic flair that impresses professors and recruiters.</p></div><div class="builder-card"><h3>Professionals</h3><p>Present your portfolio websites as dynamic reels that stand out on social media.</p></div><div class="builder-card"><h3>Businesses</h3><p>Enhance your corporate presence with explainer videos that highlight your services effectively.</p></div></div></div></section><section id="pricing" class="pricing-section"><div class="section-container"><div class="section-header-center"><h2 class="section-title">Simple <span class="text-muted">Pricing</span></h2><p class="section-desc">Cancel anytime · No hidden fees</p></div><div class="pricing-grid pricing-grid-duo"><div class="pricing-card pricing-card-highlight"><div class="pricing-badge">Most Popular</div><div class="pricing-card-head"><h3 class="pricing-name">Pro</h3></div><div class="pricing-price-wrap"><span class="pricing-price">$15</span><span class="pricing-period">/month</span></div><p class="pricing-subnote">2 day Free trial</p><ul class="pricing-features"><li>30 Credits / Month</li><li>1080p · 60 FPS export</li><li>Premium AI voices (ElevenLabs)</li><li>Smart BGM auto-matching</li><li>Editor with timeline &amp; scene tweaks</li><li>Priority email support</li></ul></div><div class="pricing-card"><div class="pricing-card-head"><h3 class="pricing-name">Credit Pack</h3></div><div class="pricing-price-wrap"><span class="pricing-price">$3</span><span class="pricing-period">one-time</span></div><p class="pricing-subnote">Credits never expire</p><ul class="pricing-features"><li>3 Credits</li><li>1080p · 60 FPS export</li><li>Premium AI voices (ElevenLabs)</li><li>Landscape &amp; Portrait formats</li><li>No subscription required</li><li>Pay only when you need</li></ul></div></div></div></section>${faqHtml}</div>`;

  return { html: homeHtml, faqs };
}

// ========== Helpers ==========

function esc(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { renderBlogPost, renderBlogList, renderHomepage };
