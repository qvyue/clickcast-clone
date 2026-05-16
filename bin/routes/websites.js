/**
 * Websites Routes
 * Handles website data retrieval, audio files, and image uploads
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { validateDomain } = require('../utils/state');
const { getAudioDuration } = require('../utils/audio');

const router = express.Router();

/**
 * Multer file upload middleware configuration
 * @description Used for handling image upload requests
 * @property {string} dest - Temporary storage directory
 * @property {Object} limits - File size limit (10MB)
 * @property {Function} fileFilter - File type filter, only allows PNG/JPG/WEBP
 */
const upload = multer({
  dest: 'tmp/uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPG, WEBP allowed.'));
    }
  }
});

/**
 * Get single website complete data
 * @route GET /api/websites/:domain
 * @param {string} domain - Website domain (URL parameter)
 * @returns {Object} Website data object with step statuses
 * @returns {Object} steps.screenshot - Screenshot step status and file list
 * @returns {Object} steps.analysis - Analysis step status and script/style data
 * @returns {Object} steps.voiceover - Voiceover step status and file list
 * @returns {Object} steps.timeline - Timeline step status and data
 * @returns {Object} steps.render - Render step status and output file list
 * @throws {400} Invalid domain format
 * @throws {404} Website directory not found
 */
router.get('/:domain', (req, res) => {
  const { domain } = req.params;

  // Validate domain format
  if (!validateDomain(domain)) {
    return res.status(400).json({ error: 'Invalid domain' });
  }

  const websiteDir = path.join(__dirname, '../../websites', domain);
  const publicDir = path.join(websiteDir, 'public');
  const outDir = path.join(websiteDir, 'out');

  // Check if website directory exists
  if (!fs.existsSync(websiteDir)) {
    return res.status(404).json({ error: 'Website not found' });
  }

  // ========== Read screenshot files ==========
  let screenshotFiles = [];
  let scrapedData = null;
  if (fs.existsSync(publicDir)) {
    const files = fs.readdirSync(publicDir);
    // Filter screenshot files starting with 'shot' and ending with .png
    screenshotFiles = files.filter(f => f.startsWith('shot') && f.endsWith('.png'));

    // Read web scrape data
    const scrapedPath = path.join(publicDir, 'scraped.json');
    if (fs.existsSync(scrapedPath)) {
      try {
        scrapedData = JSON.parse(fs.readFileSync(scrapedPath, 'utf-8'));
      } catch (e) {}
    }
  }

  // ========== Read audio files ==========
  let audioFiles = [];
  const audioFiles_path = path.join(publicDir);
  if (fs.existsSync(audioFiles_path)) {
    const files = fs.readdirSync(audioFiles_path);
    audioFiles = files
      .filter(f => f.endsWith('.mp3'))
      .map(f => {
        const filePath = path.join(audioFiles_path, f);
        const stats = fs.statSync(filePath);
        return {
          name: f,
          size: stats.size,
          // Duration would require audio parsing, skip for now
          duration: 0
        };
      });
  }

  // ========== Read timeline data ==========
  let timelineData = null;
  const timelinePath = path.join(publicDir, 'timeline.json');
  if (fs.existsSync(timelinePath)) {
    try {
      timelineData = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
    } catch (e) {}
  }

  // Extract style configuration from timeline
  let styleData = null;
  if (timelineData && timelineData.style) {
    styleData = timelineData.style;
  }

  // ========== Read render output files ==========
  let renderFiles = [];
  if (fs.existsSync(outDir)) {
    renderFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.mp4'));
  }

  // ========== Build response data ==========
  // Determine status based on file existence for each step
  const result = {
    domain,
    status: 'completed',
    steps: {
      screenshot: {
        status: screenshotFiles.length > 0 ? 'completed' : 'pending',
        files: screenshotFiles,
        scraped: scrapedData
      },
      analysis: {
        status: styleData ? 'completed' : 'pending',
        script: timelineData ? { product: timelineData.product, scenes: timelineData.scenes } : null,
        style: styleData
      },
      voiceover: {
        status: audioFiles.length > 0 ? 'completed' : 'pending',
        files: audioFiles
      },
      timeline: {
        status: timelineData ? 'completed' : 'pending',
        data: timelineData
      },
      render: {
        status: renderFiles.length > 0 ? 'completed' : 'pending',
        files: renderFiles
      }
    }
  };

  res.json(result);
});

/**
 * Get audio file list
 * @route GET /api/websites/:domain/audio
 * @param {string} domain - Website domain (URL parameter)
 * @returns {Array<Object>} Audio file list, each item contains name, size, duration
 * @description Returns info for all MP3 files in the website's public directory
 */
router.get('/:domain/audio', async (req, res) => {
  const { domain } = req.params;

  // Validate domain format
  if (!validateDomain(domain)) {
    return res.status(400).json({ error: 'Invalid domain' });
  }

  const publicDir = path.join(__dirname, '../../websites', domain, 'public');

  // Return empty array if directory doesn't exist
  if (!fs.existsSync(publicDir)) {
    return res.json([]);
  }

  // Get all MP3 files
  const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.mp3'));

  // Build file info list
  // Note: Duration field requires audio library (like ffprobe), defaulting to 0
  const audioFiles = files.map(f => {
    const filePath = path.join(publicDir, f);
    const stats = fs.statSync(filePath);
    return {
      name: f,
      size: stats.size,
      duration: 0 // Would need ffprobe or similar to get duration
    };
  });

  res.json(audioFiles);
});

/**
 * Get audio file duration
 * @route GET /api/websites/:domain/audio/:filename/duration
 * @param {string} domain - Website domain (URL parameter)
 * @param {string} filename - Audio filename (URL parameter)
 * @returns {Object} { filename, duration }
 * @returns {Object} { error: string } on error
 * @throws {400} Invalid domain
 * @throws {404} Audio file not found
 * @description Returns the duration of a specific audio file using ffprobe
 */
router.get('/:domain/audio/:filename/duration', (req, res) => {
  const { domain, filename } = req.params;

  // Validate domain format
  if (!validateDomain(domain)) {
    return res.status(400).json({ error: 'Invalid domain' });
  }

  // Security check: prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(__dirname, '../../websites', domain, 'public', filename);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Audio file not found' });
  }

  // Get audio duration using ffprobe
  const duration = getAudioDuration(filePath);
  res.json({ filename, duration });
});

/**
 * Upload image
 * @route POST /api/websites/:domain/images
 * @param {string} domain - Website domain (URL parameter)
 * @formdata {File} image - Image file (supports PNG/JPG/WEBP, max 10MB)
 * @returns {Object} { success, filename, url, width, height, isLongImage }
 * @returns {Object} { error: string } on error
 * @throws {400} Invalid domain or no file uploaded
 * @throws {500} Failed to save image
 * @description
 *   - Auto-generates unique filename (custom_{timestamp}.{ext})
 *   - Uses sharp library to get image dimensions
 *   - isLongImage flag indicates if image is tall (height/width > 1.2)
 */
router.post('/:domain/images', upload.single('image'), async (req, res) => {
  const { domain } = req.params;

  // Validate domain format
  if (!validateDomain(domain)) {
    return res.status(400).json({ error: 'Invalid domain' });
  }

  // Check if file was uploaded
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const publicDir = path.join(__dirname, '../../websites', domain, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Determine safe extension based on mimetype
  const ALLOWED_MIMETYPES = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp'
  };
  const ext = ALLOWED_MIMETYPES[req.file.mimetype] || '.png';
  const filename = `custom_${Date.now()}${ext}`;
  const destPath = path.join(publicDir, filename);

  try {
    // Move temp file to destination directory
    fs.renameSync(req.file.path, destPath);

    // Use sharp library to get image metadata
    const sharp = require('sharp');
    const metadata = await sharp(destPath).metadata();
    const width = metadata.width;
    const height = metadata.height;

    // Determine if image is tall (height significantly greater than width)
    const isLongImage = height && width && (height / width > 1.2);

    res.json({
      success: true,
      filename,
      url: `/websites/${domain}/public/${filename}`,
      width,
      height,
      isLongImage
    });
  } catch (e) {
    // Clean up temp file on error
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to save image' });
  }
});

module.exports = router;
