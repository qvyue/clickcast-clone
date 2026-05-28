/**
 * Voiceover Routes
 * Handles voiceover generation using ElevenLabs TTS
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { validateDomain } = require('../utils/state');
const { getAudioDuration } = require('../utils/audio');

const { generateSpeech, isElevenLabsConfigured, CONFIG: ttsConfig } = require('../../lib/elevenlabs-tts.js');

const router = express.Router();

function getAudioFilename(sceneId, sceneIndex, type) {
  if (sceneId === 'intro') {
    return type === 'sub' ? 'intro-sub.mp3' : 'intro.mp3';
  } else if (sceneId === 'outro') {
    return type === 'sub' ? 'outro-sub.mp3' : 'outro.mp3';
  } else if (sceneId && sceneId.startsWith('scene')) {
    const sceneNum = sceneId.replace('scene', '');
    return type === 'sub' ? `scene${sceneNum}-sub.mp3` : `scene${sceneNum}-main.mp3`;
  } else {
    return type === 'sub' ? `scene${sceneIndex}-sub.mp3` : `scene${sceneIndex}-main.mp3`;
  }
}

router.post('/:domain/voiceover/preview', async (req, res) => {
  const { domain } = req.params;
  const { sceneIndex, text, type = 'main' } = req.body;

  if (!validateDomain(domain)) {
    return res.status(400).json({ error: 'Invalid domain' });
  }

  if (sceneIndex === undefined || sceneIndex === null) {
    return res.status(400).json({ error: 'sceneIndex is required' });
  }

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required' });
  }

  if (!isElevenLabsConfigured()) {
    return res.status(503).json({ error: 'ElevenLabs API key not configured' });
  }

  const publicDir = path.join(__dirname, '../../websites', domain, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const { sceneId } = req.body;
  const outputFilename = getAudioFilename(sceneId, sceneIndex, type);
  const outputPath = path.join(publicDir, outputFilename);
  try {
    const success = await generateSpeech(text, outputPath, ttsConfig.VOICE_ID);

    if (success) {
      const duration = getAudioDuration(outputPath);
      console.log(`Voiceover generated: ${domain}/${outputFilename} (${duration.toFixed(2)}s)`);

      // 上传音频到 R2（非阻塞）
      try {
        const { isR2Configured, uploadResource } = require('../../lib/r2-storage.js');
        if (isR2Configured()) {
          const r2Key = `resources/${domain}/public/${outputFilename}`;
          uploadResource(outputPath, r2Key).catch(err => {
            console.error(`R2 voiceover upload error:`, err.message);
          });
        }
      } catch (e) {}

      res.json({
        audioFile: outputFilename,
        duration,
        type
      });
    } else {
      console.error('ElevenLabs TTS generation failed');
      res.status(500).json({ error: 'Voiceover generation failed. Please try again later.' });
    }
  } catch (e) {
    console.error('ElevenLabs TTS error:', e.message);
    res.status(500).json({ error: `TTS error: ${e.message}` });
  }
});

router.post('/:domain/voiceover/generate', async (req, res) => {
  const { domain } = req.params;
  const { sceneIndex, text, type = 'main' } = req.body;

  if (!validateDomain(domain)) {
    return res.status(400).json({ error: 'Invalid domain' });
  }

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' });
  }

  if (!isElevenLabsConfigured()) {
    return res.status(503).json({ error: 'ElevenLabs API key not configured' });
  }

  const publicDir = path.join(__dirname, '../../websites', domain, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const { sceneId } = req.body;
  const audioFile = getAudioFilename(sceneId, sceneIndex, type);
  const outputPath = path.join(publicDir, audioFile);
  try {
    const success = await generateSpeech(text, outputPath, ttsConfig.VOICE_ID);

    if (success) {
      const stats = fs.statSync(outputPath);
      const duration = getAudioDuration(outputPath);

      // 上传音频到 R2（非阻塞）
      try {
        const { isR2Configured, uploadResource } = require('../../lib/r2-storage.js');
        if (isR2Configured()) {
          const r2Key = `resources/${domain}/public/${audioFile}`;
          uploadResource(outputPath, r2Key).catch(err => {
            console.error(`R2 voiceover upload error:`, err.message);
          });
        }
      } catch (e) {}

      res.json({
        success: true,
        audioFile,
        path: `/websites/${domain}/public/${audioFile}`,
        size: stats.size,
        duration
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
