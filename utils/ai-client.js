/**
 * Shared AI API Client
 *
 * Provides a unified callAI() function that encapsulates the repeated pattern
 * of POST-ing to an OpenAI-compatible /v1/chat/completions endpoint, cleaning
 * markdown code fences from the response, and extracting parsed JSON.
 *
 * Environment variables used (loaded automatically via utils/env.js):
 *   DEEPSEEK_API_KEY / OPENAI_API_KEY  - API key
 *   API_BASE_URL                       - Base URL (default https://api.deepseek.com)
 *   AI_MODEL                           - Model name  (default deepseek-chat)
 */

const https = require('https');
const { loadEnv } = require('./env');

// Ensure .env is loaded on first require.
loadEnv();

// ---------------------------------------------------------------------------
// Config (resolved once at require time)
// ---------------------------------------------------------------------------
const CONFIG = {
  API_KEY: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
  API_BASE_URL: process.env.API_BASE_URL || 'https://api.deepseek.com',
  AI_MODEL: process.env.AI_MODEL || 'deepseek-chat',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip markdown code fences from a string.
 */
function cleanMarkdownFences(text) {
  return text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

/**
 * Try to extract and parse JSON from a raw content string.
 * Looks for JSON arrays first, then objects, then tries the whole string.
 *
 * @param {string} content
 * @returns {object|array|null}
 */
function extractJSON(content) {
  const cleaned = cleanMarkdownFences(content);

  // Try array first (some endpoints return a top-level array)
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch (_) {
      // continue to object match
    }
  }

  // Try object
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch (_) {
      // continue to direct parse
    }
  }

  // Try parsing the entire cleaned content
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Call an OpenAI-compatible chat-completions API and return parsed JSON.
 *
 * @param {string} prompt        The user prompt to send.
 * @param {object} [options]
 * @param {number} [options.maxTokens=2000]  max_tokens parameter.
 * @param {number} [options.temperature=0.7] Sampling temperature.
 * @param {number} [options.maxRetries=2]    How many times to retry on failure.
 * @param {string} [options.model]           Override the default model.
 * @returns {Promise<object|array|null>} Parsed JSON from the response, or null.
 */
async function callAI(prompt, options = {}) {
  const {
    maxTokens = 2000,
    temperature = 0.7,
    maxRetries = 2,
    model,
  } = options;

  if (!CONFIG.API_KEY) {
    console.log('Warning: API Key not set, callAI returning null');
    return null;
  }

  const useModel = model || CONFIG.AI_MODEL;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await new Promise((resolve, reject) => {
        const postData = JSON.stringify({
          model: useModel,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature,
        });

        const url = new URL(`${CONFIG.API_BASE_URL}/v1/chat/completions`);

        const reqOptions = {
          hostname: url.hostname,
          port: 443,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.API_KEY}`,
            'Content-Length': Buffer.byteLength(postData),
          },
        };

        const req = https.request(reqOptions, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.choices && json.choices[0]) {
                const content = json.choices[0].message.content;
                const parsed = extractJSON(content);
                if (parsed !== null) {
                  resolve(parsed);
                } else {
                  reject(new Error('No valid JSON found in response'));
                }
              } else {
                reject(new Error('Invalid API response'));
              }
            } catch (e) {
              reject(e);
            }
          });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
      });

      return result;
    } catch (error) {
      console.log(`   Warning: AI call failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}`);
      if (attempt === maxRetries) {
        return null;
      }
      // Wait briefly before retrying
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return null;
}

module.exports = {
  callAI,
  extractJSON,
  cleanMarkdownFences,
  CONFIG,
};
