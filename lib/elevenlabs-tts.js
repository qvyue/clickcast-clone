/**
 * ElevenLabs TTS Module
 * 高质量 AI 语音合成
 *
 * 语音一致性说明：
 * =====================================
 * 为确保主字幕和次字幕的语音一致，本模块使用固定的参数配置。
 * 所有参数均来自 ElevenLabs 官网默认值：
 *   - Voice: Dallin (alFofuDn3cOwyoz1i44T)
 *   - Speed: 0.95
 *   - Stability: 38% (0.38)
 *   - Similarity: 85% (0.85)
 *   - Style: 50% (0.5)
 *   - Speaker Boost: Enabled
 *
 * 重要：请勿随意修改这些参数，否则会导致语音不一致。
 * =====================================
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const { loadEnv } = require('../utils/env');
loadEnv();

const CONFIG = {
  API_KEY: process.env.ELEVENLABS_API_KEY || '',
  // 默认声音 ID：Dallin
  DEFAULT_VOICE_ID: 'alFofuDn3cOwyoz1i44T',
  // 当前使用的声音 ID，通过 ELEVENLABS_VOICE_ID 环境变量配置
  VOICE_ID: process.env.ELEVENLABS_VOICE_ID || 'alFofuDn3cOwyoz1i44T',
  // Eleven Flash v2.5 - 快速、高质量
  MODEL: 'eleven_flash_v2_5',
};

/**
 * 语音设置 - 固定参数确保一致性
 * 这些参数来自 ElevenLabs 官网默认值，请勿修改
 */
const VOICE_SETTINGS = {
  // 稳定性 (0-1): 0.38 = 38%，控制语音的一致性
  // 较高值 = 更稳定但可能单调，较低值 = 更有表现力但可能不稳定
  stability: 0.38,

  // 相似度 (0-1): 0.85 = 85%，控制与原声音的相似程度
  // 较高值 = 更接近原声，较低值 = 可能偏离原声
  similarity_boost: 0.85,

  // 风格 (0-1): 0.5 = 50%，控制语音风格的表现力
  // 较高值 = 更有表现力，较低值 = 更中性
  style: 0.5,

  // 扬声器增强：启用后可提高语音质量和一致性
  use_speaker_boost: true,

  // 语速 (0.1-2.0): 0.95 略慢于正常语速，适合解说
  speed: 0.95
};

/**
 * 检查 ElevenLabs 是否配置
 */
function isElevenLabsConfigured() {
  return !!CONFIG.API_KEY;
}

/**
 * 生成语音（带自动重试）
 * @param {string} text - 要合成的文本
 * @param {string} outputPath - 输出 MP3 路径
 * @param {string} voiceId - 声音 ID (默认使用 CONFIG.VOICE_ID)
 * @param {number} maxRetries - 最大重试次数 (默认 3)
 * @returns {Promise<boolean>}
 *
 * 注意：为确保语音一致性，所有调用都使用相同的 VOICE_SETTINGS 参数。
 * 请勿在调用时传入不同的参数，否则会导致主字幕和次字幕语音不一致。
 */
async function generateSpeech(text, outputPath, voiceId = CONFIG.VOICE_ID, maxRetries = 3) {
  if (!CONFIG.API_KEY) {
    console.log('   ⚠️ ElevenLabs API Key 未配置');
    return false;
  }

  voiceId = voiceId || CONFIG.VOICE_ID;

  // 使用固定的语音设置，确保每次调用参数一致
  const postData = JSON.stringify({
    text: text,
    model_id: CONFIG.MODEL,
    voice_settings: VOICE_SETTINGS
  });

  // 带重试的请求函数
  const makeRequest = () => new Promise((resolve) => {
    const options = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: `/v1/text-to-speech/${voiceId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': CONFIG.API_KEY,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errorData = '';
        res.on('data', chunk => errorData += chunk);
        res.on('end', () => {
          console.log(`   ⚠️ ElevenLabs API 错误 (${res.statusCode}): ${errorData.substring(0, 100)}`);
          resolve(false);
        });
        return;
      }

      const writeStream = fs.createWriteStream(outputPath);
      res.pipe(writeStream);

      writeStream.on('finish', () => {
        writeStream.close();
        resolve(true);
      });

      writeStream.on('error', (e) => {
        console.log(`   ⚠️ 写入文件失败: ${e.message}`);
        resolve(false);
      });
    });

    req.on('error', (e) => {
      console.log(`   ⚠️ ElevenLabs 请求失败: ${e.message}`);
      resolve(false);
    });

    req.write(postData);
    req.end();
  });

  // 重试循环
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await makeRequest();
    if (result) return true;

    if (attempt < maxRetries) {
      console.log(`   重试 ${attempt}/${maxRetries - 1}...`);
      await new Promise(r => setTimeout(r, 2000)); // 等待 2 秒后重试
    }
  }

  return false;
}

/**
 * 获取账户使用情况
 */
async function getUsageInfo() {
  if (!CONFIG.API_KEY) return null;

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: '/v1/user/subscription',
      method: 'GET',
      headers: {
        'xi-api-key': CONFIG.API_KEY
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.end();
  });
}

module.exports = {
  isElevenLabsConfigured,
  generateSpeech,
  getUsageInfo,
  CONFIG
};