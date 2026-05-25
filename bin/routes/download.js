/**
 * Download Route
 * Proxies cross-origin video URLs and forces browser download
 * via Content-Disposition header.
 *
 * @route GET /api/download?url=...&name=...
 */

const express = require('express');
const https = require('https');
const http = require('http');

const router = express.Router();

/**
 * Download proxy
 * @route GET /api/download
 * @query {string} url  - Remote video URL (required)
 * @query {string} name - Filename for download (optional, defaults to 'video.mp4')
 */
router.get('/', (req, res) => {
  const { url, name } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Validate URL scheme
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return res.status(400).json({ error: 'Invalid url scheme' });
  }

  const filename = name || 'video.mp4';

  // Choose http or https module based on URL scheme
  const client = url.startsWith('https://') ? https : http;

  client.get(url, { timeout: 30000 }, (upstream) => {
    // If redirect, follow it
    if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
      upstream.resume();
      return res.redirect(`/api/download?url=${encodeURIComponent(upstream.headers.location)}&name=${encodeURIComponent(filename)}`);
    }

    if (upstream.statusCode !== 200) {
      upstream.resume();
      return res.status(upstream.statusCode).json({ error: `Upstream returned ${upstream.statusCode}` });
    }

    // Stream response with download headers
    const contentType = upstream.headers['content-type'] || 'video/mp4';
    const contentLength = upstream.headers['content-length'];

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    upstream.pipe(res);
  }).on('error', (err) => {
    console.error('Download proxy error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Failed to fetch remote file' });
    }
  }).on('timeout', () => {
    console.error('Download proxy timeout:', url);
    if (!res.headersSent) {
      res.status(504).json({ error: 'Remote file fetch timed out' });
    }
  });
});

module.exports = router;
