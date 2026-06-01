/**
 * Videos Routes
 * Handles video listing and deletion operations
 * All routes require authentication and are scoped to the current user.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { validateDomain, r2VideoUrls } = require('../utils/state');
const { requireAuth } = require('../utils/auth');
const { getUserVideos, isVideoOwner, deleteVideoRecord } = require('../utils/videos');

// R2 Storage
const { isR2Configured, listVideos, deleteVideo: deleteFromR2, deleteDomainResources } = require('../../lib/r2-storage.js');

const router = express.Router();

// All video routes require authentication
router.use(requireAuth);

/**
 * Get generated video list for the current user
 * @route GET /api/videos
 * @query {number} [limit=50] - Return count limit
 * @returns {Object} { videos: Array, total: number, r2Enabled: boolean }
 * @description
 *   Queries Supabase for user's video records, then enriches with
 *   file info from local/R2 storage.
 */
router.get('/', async (req, res) => {
  const userId = req.user.sub;
  const limit = parseInt(req.query.limit) || 50;

  // Get user's video records from Supabase
  const userRecords = await getUserVideos(userId);

  const useR2 = isR2Configured();
  const videos = [];

  // For each record, check local/R2 for actual file and enrich with URL/size
  for (const record of userRecords) {
    const { domain, aspect_ratio, storage, created_at } = record;
    const videoFile = `${aspect_ratio}.mp4`;
    let found = false;

    // Check R2 first
    if (useR2) {
      try {
        const r2Videos = await listVideos();
        const match = r2Videos.find(v => v.key === `videos/${domain}/${videoFile}`);
        if (match) {
          videos.push({
            domain,
            file: videoFile,
            url: match.url,
            size: match.size ? Math.round(match.size / 1024 / 1024 * 10) / 10 : null,
            created: match.lastModified || created_at,
            storage: 'r2'
          });
          found = true;
        }
      } catch (e) {
        console.error('R2 list error:', e.message);
      }
    }

    // Fallback to local storage
    if (!found) {
      const videoPath = path.join(__dirname, '../../websites', domain, 'out', videoFile);
      if (fs.existsSync(videoPath)) {
        const stats = fs.statSync(videoPath);
        videos.push({
          domain,
          file: videoFile,
          url: `/websites/${domain}/out/${videoFile}`,
          size: Math.round(stats.size / 1024 / 1024 * 10) / 10,
          created: stats.mtime,
          storage: 'local'
        });
      } else {
        // File not found on disk yet (still generating or deleted), still show record
        videos.push({
          domain,
          file: videoFile,
          url: `/websites/${domain}/out/${videoFile}`,
          size: null,
          created: created_at,
          storage
        });
      }
    }
  }

  // Sort by creation time descending, apply limit
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
 * @throws {403} Not authorized to delete this video
 * @throws {404} Video not found
 * @throws {500} Deletion failed
 * @description
 *   Deletes:
 *   - R2 cloud storage video files (if configured)
 *   - Local website directory (including screenshots, audio, render outputs)
 *   - R2 URL cache
 *   - Supabase video records
 */
router.delete('/:domain', async (req, res) => {
  const { domain } = req.params;
  const userId = req.user.sub;

  // Validate domain format, prevent path traversal attack
  if (!validateDomain(domain)) {
    return res.status(400).json({ error: 'Invalid domain' });
  }

  // Check ownership
  const owned = await isVideoOwner(userId, domain);
  if (!owned) {
    return res.status(403).json({ error: 'Not authorized to delete this video' });
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
    // 清理 R2 resources（截图、音频、timeline.json 等）
    try {
      await deleteDomainResources(domain);
    } catch (e) {
      console.error('R2 resources delete error:', e.message);
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

    // Delete Supabase video records
    await deleteVideoRecord(userId, domain);

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (e) {
    console.error('Delete error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
