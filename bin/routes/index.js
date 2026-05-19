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

module.exports = (app) => {
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
};
