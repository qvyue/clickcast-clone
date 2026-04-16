/**
 * Videos Routes
 * Handles video listing and deletion operations
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { validateDomain, r2VideoUrls } = require('../utils/state');

// R2 Storage
const { isR2Configured, listVideos, deleteVideo: deleteFromR2 } = require('../../lib/r2-storage.js');

const router = express.Router();

/**
 * Get generated video list
 * @route GET /api/videos
 * @query {number} [limit=5] - Return count limit
 * @returns {Object} { videos: Array, total: number, r2Enabled: boolean }
 * @description
 *   Prioritizes R2 cloud storage for video list (if configured),
 *   also checks local storage for local development compatibility
 */
router.get('/', async (req, res) => {
  const websitesDir = path.join(__dirname, '../../websites');
  const videos = [];
  const limit = parseInt(req.query.limit) || 5; // Default 5

  // Check if R2 cloud storage is configured
  const useR2 = isR2Configured();

  // If R2 is configured, prioritize getting video list from R2
  if (useR2) {
    try {
      const r2Videos = await listVideos();
      // Parse R2 object path: videos/{domain}/{filename}
      r2Videos.forEach(v => {
        const parts = v.key.split('/');
        const domain = parts[1];
        const file = parts[2];
        if (domain && file) {
          videos.push({
            domain,
            file,
            url: v.url,
            size: v.size ? Math.round(v.size / 1024 / 1024 * 10) / 10 : null,
            created: v.lastModified,
            storage: 'r2'
          });
        }
      });
    } catch (e) {
      console.error('R2 list error:', e.message);
    }
  }

  // Also check local storage (compatible with local development)
  if (fs.existsSync(websitesDir)) {
    // Get all website directories
    const domains = fs.readdirSync(websitesDir).filter(f => {
      return fs.statSync(path.join(websitesDir, f)).isDirectory();
    });

    // Iterate each website's output directory
    domains.forEach(domain => {
      const outDir = path.join(websitesDir, domain, 'out');
      if (fs.existsSync(outDir)) {
        // Check landscape and portrait videos
        ['landscape.mp4', 'portrait.mp4'].forEach(videoFile => {
          const videoPath = path.join(outDir, videoFile);
          if (fs.existsSync(videoPath)) {
            // Check if already retrieved from R2, avoid duplicates
            const exists = videos.some(v => v.domain === domain && v.file === videoFile);
            if (!exists) {
              const stats = fs.statSync(videoPath);
              videos.push({
                domain,
                file: videoFile,
                url: `/websites/${domain}/out/${videoFile}`,
                size: Math.round(stats.size / 1024 / 1024 * 10) / 10, // Convert to MB
                created: stats.mtime,
                storage: 'local'
              });
            }
          }
        });
      }
    });
  }

  // Sort by creation time descending, limit return count
  videos.sort((a, b) => new Date(b.created) - new Date(a.created));
  const limitedVideos = videos.slice(0, limit);

  res.json({ videos: limitedVideos, total: videos.length, r2Enabled: useR2 });
});

/**
 * Delete video and cache data
 * @route DELETE /api/delete/:domain
 * @param {string} domain - Website domain (URL parameter)
 * @returns {Object} { success: true, message: string }
 * @returns {Object} { error: string } on error
 * @throws {400} Invalid domain or path traversal attack
 * @throws {404} Video not found
 * @throws {500} Deletion failed
 * @description
 *   Deletes:
 *   - R2 cloud storage video files (if configured)
 *   - Local website directory (including screenshots, audio, render outputs)
 *   - R2 URL cache
 */
router.delete('/:domain', async (req, res) => {
  const { domain } = req.params;

  // Validate domain format, prevent path traversal attack
  if (!validateDomain(domain)) {
    return res.status(400).json({ error: 'Invalid domain' });
  }

  const websiteDir = path.join(__dirname, '../../websites', domain);

  // Security check: ensure resolved path is still under websites directory
  const resolved = path.resolve(websiteDir);
  if (!resolved.startsWith(path.resolve(path.join(__dirname, '../../websites')))) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  // Check and delete R2 cloud storage videos
  const useR2 = isR2Configured();
  let r2Deleted = false;

  if (useR2) {
    try {
      // Delete landscape and portrait videos
      await deleteFromR2(`videos/${domain}/landscape.mp4`);
      await deleteFromR2(`videos/${domain}/portrait.mp4`);
      r2Deleted = true;
      console.log(`R2 deleted: ${domain}`);
    } catch (e) {
      console.error('R2 delete error:', e.message);
    }
  }

  // Check if local storage exists
  const localExists = fs.existsSync(websiteDir);

  // Return 404 if neither R2 nor local exists
  if (!localExists && !r2Deleted) {
    return res.status(404).json({ error: 'Video not found' });
  }

  try {
    // Delete local files
    if (localExists) {
      fs.rmSync(websiteDir, { recursive: true, force: true });
      console.log(`Deleted local: ${websiteDir}`);
    }

    // Clear R2 URL cache entries related to this domain
    for (const [key] of r2VideoUrls) {
      if (key.includes(domain)) {
        r2VideoUrls.delete(key);
      }
    }

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (e) {
    console.error('Delete error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
