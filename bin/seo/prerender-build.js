/**
 * Build-Time Pre-Rendering Script
 *
 * Runs after `vite build` during Docker image build.
 * Starts a temp Express server, uses Playwright to render static pages,
 * saves fully rendered HTML to frontend/dist/prerender/.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { resolveMeta } = require('./resolve');
const { injectMeta } = require('./inject');

// /blog is rendered at runtime (needs Supabase data not available during Docker build)
const STATIC_ROUTES = ['/', '/terms', '/privacy'];

async function main() {
  const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
  if (!fs.existsSync(frontendDistPath)) {
    console.error('[prerender-build] frontend/dist not found. Run `npm run build` first.');
    process.exit(1);
  }

  // 1. Start a minimal Express server serving the built frontend
  const app = express();
  app.use(express.static(frontendDistPath, { index: false }));

  // API routes needed for pre-rendering (blog page fetches /api/blog)
  app.get('/api/blog', async (req, res) => {
    try {
      const { getAdminClient } = require('../utils/supabase-admin');
      const supabase = getAdminClient();
      if (!supabase) return res.json({ posts: [] });
      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, cover_image_url, category, author, read_time, published_at')
        .eq('is_active', true)
        .order('published_at', { ascending: false });
      res.json({ posts: data || [] });
    } catch (_) {
      res.json({ posts: [] });
    }
  });

  // API routes needed for pre-rendering (FAQ section on homepage)
  app.get('/api/faqs', async (req, res) => {
    try {
      const { getAdminClient } = require('../utils/supabase-admin');
      const supabase = getAdminClient();
      if (!supabase) return res.json({ faqs: [] });
      const { data } = await supabase
        .from('faqs')
        .select('id, question, answer, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      res.json({ faqs: data || [] });
    } catch (_) {
      res.json({ faqs: [] });
    }
  });

  // SPA fallback with SEO meta injection
  app.use(async (req, res) => {
    try {
      let html = fs.readFileSync(path.join(frontendDistPath, 'index.html'), 'utf-8');
      const meta = await resolveMeta(req.path);
      if (meta) html = injectMeta(html, meta);
      res.send(html);
    } catch (err) {
      res.status(500).send('Error');
    }
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  // 2. Create output directory
  const outputDir = path.join(frontendDistPath, 'prerender');
  fs.mkdirSync(outputDir, { recursive: true });

  // 3. Lazy-import renderer (needs Playwright)
  const { renderPage, closeBrowser } = require('./renderer');

  // 4. Render each static page
  for (const routePath of STATIC_ROUTES) {
    console.log(`[prerender-build] Rendering ${routePath}...`);
    try {
      const html = await renderPage(`${baseUrl}${routePath}`);
      if (html) {
        // Playwright renders via SPA fallback which already injects meta tags,
        // so we use the HTML directly — no second injectMeta call.

        const { pathToFilename } = require('./prerender-cache');
        const filename = pathToFilename(routePath);
        fs.writeFileSync(path.join(outputDir, filename), html);
        console.log(`[prerender-build] Saved ${filename}`);
      } else {
        console.warn(`[prerender-build] Failed to render ${routePath}`);
      }
    } catch (err) {
      console.error(`[prerender-build] Error rendering ${routePath}:`, err.message);
    }
  }

  // 5. Cleanup
  server.close();
  await closeBrowser();
  console.log('[prerender-build] Complete');
}

main().catch((err) => {
  console.error('[prerender-build] Fatal error:', err);
  process.exit(1);
});
