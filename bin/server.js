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

const app = express();
const PORT = process.env.PORT || 3000;

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
  // Serve frontend static assets (JS, CSS, etc.)
  app.use(express.static(frontendDistPath));

  // SPA fallback: return index.html for frontend routes (e.g., /editor/:domain)
  // Must be after API routes, so API calls are handled first
  // Use middleware to catch all unmatched routes
  app.use((req, res, next) => {
    // Skip if it's an API route or static file request
    if (req.path.startsWith('/api/') || req.path.startsWith('/websites/')) {
      return next();
    }
    // Return index.html for SPA routes
    res.sendFile('index.html', { root: frontendDistPath }, (err) => {
      if (err) {
        console.error('SendFile error:', err.message);
        res.status(500).send('Error loading page');
      }
    });
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
  console.log(`
========================================
   VidGen Web UI
   http://localhost:${PORT}
========================================
  `);
});
