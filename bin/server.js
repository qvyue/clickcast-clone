/**
 * VidGen Web Server
 * Provides URL input interface and video generation service
 *
 * Main features:
 * - Static website hosting
 * - Image upload endpoint
 * - Voiceover generation (Edge-TTS preview / ElevenLabs production)
 * - Video rendering (based on Remotion)
 * - Task status query
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

// Load environment variables (local development)
require('dotenv').config();

// Import shared state and utilities
const { jobs, rateLimiter, generateExamplesHtml, validateDomain } = require('./utils/state');

// Import R2 storage utilities
const { isR2Configured, ensureLocalResource } = require('../lib/r2-storage');

// Import route aggregator
const setupRoutes = require('./routes');

// Import SEO utilities
const { resolveMeta, isPrerenderablePath } = require('./seo/resolve');
const { injectMeta } = require('./seo/inject');
const { SITE_URL } = require('./seo/meta');
const { isBot } = require('./seo/bot-detect');
const { initCache, getCached, setCache, pathToFilename } = require('./seo/prerender-cache');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== Security & Compression ==========
app.use(require('compression')());
app.use(require('helmet')({
  contentSecurityPolicy: false, // CSP disabled — too complex for this app
}));

// ========== Middleware Configuration ==========
// Skip JSON body parsing for Stripe webhook — it needs raw body for signature verification
app.use((req, res, next) => {
  if (req.path === '/api/billing/webhook') return next();
  express.json()(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

// ========== Static File Service ==========
// Global public directory (BGM, common resources)
app.use(express.static(path.join(__dirname, '../public')));
// Website-specific resources directory (screenshots, audio per site)
app.use('/websites', express.static(path.join(__dirname, '../websites'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

// R2 fallback middleware: when local file is missing, try downloading from R2
app.use('/websites/:domain/public/:filename', async (req, res, next) => {
  // Only attempt R2 fallback if configured
  if (!isR2Configured()) return next();

  const { domain, filename } = req.params;

  // Validate domain and filename to prevent path traversal
  if (!validateDomain(domain) || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return next();
  }

  const publicDir = path.join(__dirname, '../websites', domain, 'public');
  const localPath = path.join(publicDir, filename);

  try {
    const available = await ensureLocalResource(domain, filename, publicDir);
    if (available) {
      res.sendFile(localPath, (err) => {
        if (err) next();
      });
    } else {
      next(); // Not in R2 either, let 404 propagate
    }
  } catch (err) {
    console.error(`R2 fallback error for ${domain}/${filename}:`, err.message);
    next();
  }
});

// ========== API Routes ==========
setupRoutes(app);

// ========== SEO Routes ==========

// robots.txt — standard location for search engine crawlers
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /editor/
Disallow: /dashboard
Disallow: /admin
Disallow: /auth/
Disallow: /websites/

Sitemap: ${SITE_URL}/sitemap.xml`);
});

// sitemap.xml — generated from static pages + active blog posts
app.get('/sitemap.xml', async (req, res) => {
  try {
    const supabase = require('./utils/supabase-admin').getAdminClient();
    const today = new Date().toISOString().split('T')[0];
    const staticPages = [
      { path: '/', changefreq: 'weekly', priority: '1.0', lastmod: today },
      { path: '/blog', changefreq: 'weekly', priority: '0.8', lastmod: today },
      { path: '/terms', changefreq: 'monthly', priority: '0.3', lastmod: today },
      { path: '/privacy', changefreq: 'monthly', priority: '0.3', lastmod: today },
    ];

    let blogUrls = '';
    if (supabase) {
      const { data: posts } = await supabase
        .from('blog_posts')
        .select('slug, updated_at')
        .eq('is_active', true);

      blogUrls = (posts || [])
        .filter((p) => p.updated_at) // skip posts without updated_at
        .map(
          (p) => `  <url>
    <loc>${SITE_URL}/blog/${p.slug}</loc>
    <lastmod>${p.updated_at.split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`,
        )
        .join('\n');
    }

    const staticUrls = staticPages
      .map(
        (p) => `  <url>
    <loc>${SITE_URL}${p.path}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
      )
      .join('\n');

    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${blogUrls}
</urlset>`);
  } catch (err) {
    console.error('Sitemap generation error:', err.message);
    res.status(500).send('Error generating sitemap');
  }
});

// ========== Homepage Route ==========
// We have migrated the homepage to the React frontend SPA.
// If the frontend is built, the SPA fallback below will handle the '/' route.
// For local development, Vite handles it.
// To ensure the root route isn't completely dead if the frontend is missing:
app.get('/', (req, res, next) => {
  if (fs.existsSync(path.resolve(__dirname, '../frontend/dist'))) {
    next(); // Pass to static file handler / SPA fallback
  } else {
    res.send('Frontend not built. Run "cd frontend && npm run build".');
  }
});

// ========== Frontend SPA Service ==========
const frontendDistPath = path.resolve(__dirname, '../frontend/dist');

// Check if frontend is built
if (fs.existsSync(frontendDistPath)) {
  // Serve frontend static assets (JS, CSS, etc.) with cache headers
  app.use(express.static(frontendDistPath, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.match(/-\w{8,}\.(js|css)$/)) {
        // Content-hashed files — cache for 1 year
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  // ========== Pre-render Middleware for Bots ==========
  // Serves fully rendered HTML to search engine / social crawlers
  // Only used for /terms and /privacy (build-time Playwright cache)
  app.use(async (req, res, next) => {
    // Skip non-page paths
    if (req.path.startsWith('/api/') || req.path.startsWith('/websites/')) {
      return next();
    }

    // Only intercept bot requests
    if (!isBot(req.headers['user-agent'])) {
      return next();
    }

    // Only pre-render known public pages
    if (!isPrerenderablePath(req.path)) {
      return next();
    }

    try {
      // 1. Try build-time cache (frontend/dist/prerender/)
      const buildCachePath = path.join(frontendDistPath, 'prerender', pathToFilename(req.path));
      if (fs.existsSync(buildCachePath)) {
        const html = fs.readFileSync(buildCachePath, 'utf-8');
        return res.send(html);
      }

      // 2. Try runtime cache (/data/prerender/)
      const cached = getCached(req.path);
      if (cached) {
        return res.send(cached);
      }

      // 3. On-demand Playwright render for /terms, /privacy etc.
      const { renderPage } = require('./seo/renderer');
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const html = await renderPage(`${baseUrl}${req.path}`);
      if (html) {
        setCache(req.path, html, 24 * 60 * 60 * 1000); // 24h TTL
        return res.send(html);
      }

      // Fallback to SPA if rendering failed
      next();
    } catch (err) {
      console.error('[prerender-mw] Error:', err.message);
      next();
    }
  });

  // ========== SSR Middleware — Core Pages ==========
  // Server-side renders /, /blog, /blog/:slug for ALL visitors (not just bots).
  // Queries Supabase directly and injects content into the SPA shell.
  const { renderBlogPost, renderBlogList, renderHomepage } = require('./seo/ssr');

  app.use(async (req, res, next) => {
    const normalized = req.path.endsWith('/') && req.path.length > 1 ? req.path.slice(0, -1) : req.path;

    try {
      // Check runtime cache first
      const cached = getCached(normalized);
      if (cached) {
        // Inject meta tags into cached SSR content
        let html = fs.readFileSync(path.join(frontendDistPath, 'index.html'), 'utf-8');
        const meta = await resolveMeta(normalized);
        if (meta) {
          if (meta.__status === 404) res.status(404);
          html = injectMeta(html, meta);
        }
        // Replace empty <div id="root"></div> with cached content
        html = html.replace('<div id="root"></div>', `<div id="root">${cached}</div>`);
        return res.send(html);
      }

      let content = null;

      // Blog post: /blog/:slug
      const blogMatch = normalized.match(/^\/blog\/([a-z0-9-]+)$/);
      if (blogMatch) {
        content = await renderBlogPost(blogMatch[1]);
      }
      // Blog listing: /blog
      else if (normalized === '/blog') {
        content = await renderBlogList();
      }
      // Homepage: /
      else if (normalized === '/') {
        content = await renderHomepage();
      }

      if (content) {
        // Cache the content (1 hour TTL)
        setCache(normalized, content, 60 * 60 * 1000);

        // Build full page with meta injection
        let html = fs.readFileSync(path.join(frontendDistPath, 'index.html'), 'utf-8');
        const meta = await resolveMeta(normalized);
        if (meta) html = injectMeta(html, meta);
        html = html.replace('<div id="root"></div>', `<div id="root">${content}</div>`);
        return res.send(html);
      }

      // Not an SSR page or SSR failed — fall through to SPA fallback
      next();
    } catch (err) {
      console.error('[ssr-mw] Error:', err.message);
      next();
    }
  });

  // SPA fallback: return index.html with SEO meta injection for frontend routes
  // Must be after API routes, so API calls are handled first
  app.use(async (req, res, next) => {
    // Skip if it's an API route or static file request
    if (req.path.startsWith('/api/') || req.path.startsWith('/websites/')) {
      return next();
    }

    try {
      let html = fs.readFileSync(path.join(frontendDistPath, 'index.html'), 'utf-8');
      const meta = await resolveMeta(req.path);

      if (meta) {
        if (meta.__status === 404) {
          res.status(404);
        }
        html = injectMeta(html, meta);
      }

      res.send(html);
    } catch (err) {
      console.error('SPA fallback error:', err.message);
      res.status(500).send('Error loading page');
    }
  });

  console.log('Frontend SPA enabled (serving from ' + frontendDistPath + ')');
} else {
  console.log('Frontend not built. Run "cd frontend && npm run build" to enable SPA routes.');
}

// ========== Server Initialization ==========

// Ensure websites directory exists
const websitesDir = path.join(__dirname, '../websites');
if (!fs.existsSync(websitesDir)) {
  fs.mkdirSync(websitesDir, { recursive: true });
}

// Verify BGM file exists
const bgmPath = path.join(__dirname, '../public', 'bensound-slowlife.mp3');
if (fs.existsSync(bgmPath)) {
  const stats = fs.statSync(bgmPath);
  console.log(`BGM file found: ${stats.size} bytes`);
} else {
  console.log(`BGM file missing: ${bgmPath}`);
}

/**
 * Auto cleanup expired jobs
 * @description Cleans up job records older than 2 hours every 30 minutes
 */
setInterval(() => {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt && Date.now() - job.createdAt > TWO_HOURS) {
      jobs.delete(id);
    }
  }
}, 30 * 60 * 1000); // Run every 30 minutes

/**
 * Periodic cleanup of expired rate limit records
 * @description Cleans up expired IP request records every minute
 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimiter) {
    if (now > entry.resetAt) {
      rateLimiter.delete(ip);
    }
  }
}, 60000); // Run every minute

// Start HTTP server
app.listen(PORT, () => {
  // Initialize pre-render cache
  initCache();

  console.log(`
========================================
   VidGen Web UI
   http://localhost:${PORT}
========================================
  `);
});

// Graceful shutdown — close Playwright browser
process.on('SIGTERM', async () => {
  try {
    const { closeBrowser } = require('./seo/renderer');
    await closeBrowser();
  } catch (_) { /* ignore */ }
  process.exit(0);
});
