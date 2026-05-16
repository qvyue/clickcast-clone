/**
 * Status Routes
 * Handles render job status queries
 */

const express = require('express');
const { jobs } = require('../utils/state');

const router = express.Router();

/**
 * Query render job status
 * @route GET /api/status/:jobId
 * @param {string} jobId - Job ID (URL parameter)
 * @returns {Object} { status, progress, message, videoUrl?, aspectRatio?, domain? }
 * @throws {404} Job not found
 * @description Used for frontend polling to query render progress
 */
router.get('/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  // Job not found
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Return job status
  res.json({
    status: job.status,
    progress: job.progress,
    message: job.message,
    videoUrl: job.videoUrl,
    aspectRatio: job.aspectRatio,
    domain: job.domain
  });
});

module.exports = router;
