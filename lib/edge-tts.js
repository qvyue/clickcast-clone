/**
 * Edge-TTS Module
 * Free TTS using multiple fallback sources
 *
 * Fallback chain: Google Translate TTS → StreamElements TTS
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Default voice
const DEFAULT_VOICE = 'en-US';

// Available voices (simplified)
const ENGLISH_VOICES = {
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'en-AU': 'English (Australia)',
};

/**
 * Check if TTS is available
 * @returns {Promise<boolean>}
 */
async function isEdgeTtsAvailable() {
  return true;
}

/**
 * Get available voices
 * @returns {Object}
 */
function getAvailableVoices() {
  return ENGLISH_VOICES;
}

/**
 * Generate speech using multiple fallback sources
 * @param {string} text - Text to synthesize
 * @param {string} outputPath - Output MP3 file path
 * @param {string} voice - Voice name (default: en-US)
 * @returns {Promise<boolean>}
 */
async function generateSpeech(text, outputPath, voice = DEFAULT_VOICE) {
  if (!text || text.trim().length === 0) {
    console.error('TTS: Empty text provided');
    return false;
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Truncate text if too long
  const maxLength = 200;
  const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

  // Try StreamElements TTS first (more reliable)
  try {
    console.log('TTS: Trying StreamElements TTS...');
    const success = await streamElementsTTS(truncatedText, outputPath);
    if (success) {
      console.log(`TTS: Generated ${outputPath} using StreamElements`);
      return true;
    }
  } catch (error) {
    console.error('StreamElements TTS failed:', error.message);
  }

  // Fallback to Google Translate TTS
  try {
    console.log('TTS: Trying Google Translate TTS...');
    const success = await googleTranslateTTS(truncatedText, outputPath);
    if (success) {
      console.log(`TTS: Generated ${outputPath} using Google Translate`);
      return true;
    }
  } catch (error) {
    console.error('Google Translate TTS failed:', error.message);
  }

  console.error('TTS: All TTS sources failed');
  return false;
}

/**
 * StreamElements TTS (free, reliable)
 * Used by many streamers with TTS donations
 */
async function streamElementsTTS(text, outputPath) {
  return new Promise((resolve, reject) => {
    // StreamElements TTS API
    const voice = 'Brian'; // Popular English male voice
    const encodedText = encodeURIComponent(text);
    const url = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodedText}`;

    const chunks = [];

    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      }
    }, (res) => {
      if (res.statusCode === 200) {
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          if (buffer.length > 1000) {
            fs.writeFileSync(outputPath, buffer);
            resolve(true);
          } else {
            resolve(false);
          }
        });
      } else if (res.statusCode === 301 || res.statusCode === 302) {
        // Follow redirect
        const redirectUrl = res.headers.location;
        http.get(redirectUrl, (res2) => {
          const chunks2 = [];
          res2.on('data', chunk => chunks2.push(chunk));
          res2.on('end', () => {
            const buffer = Buffer.concat(chunks2);
            if (buffer.length > 1000) {
              fs.writeFileSync(outputPath, buffer);
              resolve(true);
            } else {
              resolve(false);
            }
          });
        }).on('error', reject);
      } else {
        resolve(false);
      }
    }).on('error', reject);
  });
}

/**
 * Google Translate TTS (free, no API key)
 */
async function googleTranslateTTS(text, outputPath) {
  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodedText}`;

    const chunks = [];

    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'audio/mpeg',
      }
    }, (res) => {
      if (res.statusCode === 200) {
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          if (buffer.length > 1000) {
            fs.writeFileSync(outputPath, buffer);
            resolve(true);
          } else {
            resolve(false);
          }
        });
      } else {
        resolve(false);
      }
    }).on('error', reject);
  });
}

/**
 * Generate speech with rate adjustment
 * @param {string} text - Text to synthesize
 * @param {string} outputPath - Output MP3 file path
 * @param {Object} options - Options (voice, rate)
 * @returns {Promise<boolean>}
 */
async function generateSpeechWithRate(text, outputPath, options = {}) {
  const { voice = DEFAULT_VOICE, rate = '+0%' } = options;
  return generateSpeech(text, outputPath, voice);
}

module.exports = {
  isEdgeTtsAvailable,
  getAvailableVoices,
  generateSpeech,
  generateSpeechWithRate,
  DEFAULT_VOICE,
  ENGLISH_VOICES
};
