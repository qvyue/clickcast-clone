/**
 * Voiceover Routes
 * Handles voiceover generation (preview with Edge-TTS, production with ElevenLabs)
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { validateDomain } = require('../utils/state');

// ElevenLabs TTS - High quality speech synthesis service
const { generateSpeech, isElevenLabsConfigured } = require('../../lib/elevenlabs-tts.js');

const router = express.Router();

/**
 * Generate preview voiceover (using Edge-TTS free service)
 * @route POST /api/websites/:domain/voiceover/preview
 * @param {string} domain - Website domain (URL parameter)
 * @body {number} sceneIndex - Scene index
 * @body {string} text - Text content to convert
 * @returns {Object} { audioFile, duration } on success
 * @returns {Object} { error: string } on error
 * @throws {400} Missing required parameters
 * @throws {500} Voiceover generation failed
 */
router.post('/:domain/voiceover/preview', async (req, res) => {
  const { domain } = req.params;
  const { sceneIndex, text } = req.body;

  // Parameter validation
  if (!validateDomain(domain)) {
    return res.status(400).json({ error: 'Invalid domain' });
  }

  if (sceneIndex === undefined || sceneIndex === null) {
    return res.status(400).json({ error: 'sceneIndex is required' });
  }

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required' });
  }

  const publicDir = path.join(__dirname, '../../websites', domain, 'public');

  // Ensure target directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Generate preview audio filename
  const outputFilename = `preview_scene${sceneIndex}.mp3`;
  const outputPath = path.join(publicDir, outputFilename);

  try {
    // Call Edge-TTS to generate speech
    const edgeTts = require('../../lib/edge-tts.js');
    const success = await edgeTts.generateSpeech(text, outputPath);

    if (success) {
      console.log(`Preview voiceover generated: ${domain}/preview_scene${sceneIndex}.mp3`);
      res.json({
        audioFile: outputFilename,
        duration: 0 // Duration would need audio parsing
      });
    } else {
      res.status(500).json({ error: 'Failed to generate voiceover' });
    }
  } catch (e) {
    console.error('Edge-TTS error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * Generate production voiceover (using ElevenLabs high quality speech synthesis)
 * @route POST /api/websites/:domain/voiceover/generate
 * @param {string} domain - Website domain (URL parameter)
 * @body {number|string} sceneIndex - Scene index (number or 'intro'/'outro')
 * @body {string} text - Text content to convert
 * @body {string} [type='main'] - Voiceover type ('main' primary / 'sub' secondary)
 * @returns {Object} { success, audioFile, path, size, duration } on success
 * @returns {Object} { error: string } on error
 * @throws {400} Missing required parameters
 * @throws {503} ElevenLabs API not configured
 * @throws {500} Voiceover generation failed
 */
router.post('/:domain/voiceover/generate', async (req, res) => {
  const { domain } = req.params;
  const { sceneIndex, text, type = 'main' } = req.body;

  // Parameter validation
  if (!validateDomain(domain)) {
    return res.status(400).json({ error: 'Invalid domain' });
  }

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' });
  }

  // Check if ElevenLabs API is configured
  if (!isElevenLabsConfigured()) {
    return res.status(503).json({ error: 'ElevenLabs API key not configured' });
  }

  const publicDir = path.join(__dirname, '../../websites', domain, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Determine filename based on scene index and voiceover type
  let audioFile;
  if (sceneIndex === 'intro' || sceneIndex === undefined) {
    audioFile = type === 'sub' ? `intro-sub.mp3` : 'intro.mp3';
  } else if (sceneIndex === 'outro') {
    audioFile = type === 'sub' ? `outro-sub.mp3` : 'outro.mp3';
  } else {
    audioFile = type === 'sub' ? `scene${sceneIndex}-sub.mp3` : `scene${sceneIndex}-main.mp3`;
  }

  const outputPath = path.join(publicDir, audioFile);

  try {
    // Call ElevenLabs API to generate high quality speech
    const success = await generateSpeech(text, outputPath);

    if (success) {
      const stats = fs.statSync(outputPath);
      res.json({
        success: true,
        audioFile,
        path: `/websites/${domain}/public/${audioFile}`,
        size: stats.size,
        duration: 0
      });
    } else {
      res.status(500).json({ error: 'Failed to generate speech' });
    }
  } catch (error) {
    console.error('Voiceover generation error:', error);
    res.status(500).json({ error: error.message || 'Voiceover generation failed' });
  }
});

module.exports = router;
