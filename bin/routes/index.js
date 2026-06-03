/**
 * Route Index
 * Aggregates all route modules
 */

const timelineRoutes = require('./timeline');
const websitesRoutes = require('./websites');
const voiceoverRoutes = require('./voiceover');
const renderRoutes = require('./render');
const statusRoutes = require('./status');
const videosRoutes = require('./videos');
const generateRoutes = require('./generate');
const benchmarkRoutes = require('./benchmark');
const downloadRoutes = require('./download');
const billingRoutes = require('./billing');
const { adminRouter, publicRouter } = require('./admin');
const { optionalAuth, requireAuth, requireAdmin } = require('../utils/auth');

module.exports = (app) => {
  // Apply optional auth to all API routes (sets req.user if token present)
  app.use('/api', optionalAuth);

  // Generate routes: POST /api/generate (自动化流程 - 放在最前面)
  app.use('/api/generate', generateRoutes);

  // Timeline routes: POST /api/timeline/:domain
  app.use('/api/timeline', timelineRoutes);

  // Websites routes: GET /api/websites/:domain, GET /api/websites/:domain/audio, POST /api/websites/:domain/images
  app.use('/api/websites', websitesRoutes);

  // Voiceover routes: POST /api/websites/:domain/voiceover/preview, POST /api/websites/:domain/voiceover/generate
  app.use('/api/websites', voiceoverRoutes);

  // Render routes: POST /api/websites/:domain/render
  app.use('/api/websites', renderRoutes);

  // Status routes: GET /api/status/:jobId
  app.use('/api/status', statusRoutes);

  // Videos routes: GET /api/videos
  app.use('/api/videos', videosRoutes);

  // Delete routes: DELETE /api/delete/:domain
  app.use('/api/delete', videosRoutes);

  // Benchmark routes: GET /api/benchmark, GET /api/benchmark/results
  app.use('/api/benchmark', benchmarkRoutes);

  // Download proxy: GET /api/download?url=...&name=...
  app.use('/api/download', downloadRoutes);

  // Billing routes: checkout, subscription, credits, portal, webhook
  app.use('/api/billing', billingRoutes);

  // Admin routes: FAQ management (requires auth + admin)
  app.use('/api/admin', requireAuth, requireAdmin, adminRouter);

  // Public FAQ route (no auth required)
  app.use('/api', publicRouter);
};
