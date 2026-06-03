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

const STATIC_ROUTES = ['/', '/blog', '/terms', '/privacy'];

async function main() {
  const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
  if (!fs.existsSync(frontendDistPath)) {
    console.error('[prerender-build] frontend/dist not found. Run `npm run build` first.');
    process.exit(1);
  }

  // 1. Start a minimal Express server serving the built frontend
  const app = express();
  app.use(express.static(frontendDistPath, { index: false }));

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
        // Apply SEO meta tags on top of the rendered HTML
        const meta = await resolveMeta(routePath);
        const finalHtml = meta ? injectMeta(html, meta) : html;

        const { pathToFilename } = require('./prerender-cache');
        const filename = pathToFilename(routePath);
        fs.writeFileSync(path.join(outputDir, filename), finalHtml);
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
