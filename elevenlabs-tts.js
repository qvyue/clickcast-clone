/**
 * ElevenLabs TTS Module
 * 高质量 AI 语音合成
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 加载 .env
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key] = valueParts.join('=');
        }
      }
    });
  }
}
loadEnv();

const CONFIG = {
  API_KEY: process.env.ELEVENLABS_API_KEY || '',
  // ElevenLabs 声音 ID
  VOICES: {
    'Adam': 'pNInz6obpgDQGcFmaJgB',      // 专业、可信
    'Rachel': '21m00Tcm4TlvDq8ikWAM',    // 友好、温暖
    'Antoni': 'ErXwobaYiN019PkySvjV',    // 充满活力
    'Josh': 'TxGEqnHWfuWHDWyoWaKh',      // 深沉、权威
    'Bella': 'EXAVITQu4vr4xnSDxMaL',     // 柔和、优雅
    'Dallin': 'alFofuDn3cOwyoz1i44T',   // 自定义声音
  },
  DEFAULT_VOICE: 'Dallin',
  // Eleven Flash v2.5 - 快速、高质量
  MODEL: 'eleven_flash_v2_5',
};

/**
 * 检查 ElevenLabs 是否配置
 */
function isElevenLabsConfigured() {
  return !!CONFIG.API_KEY;
}

/**
 * 获取可用声音列表
 */
function getAvailableVoices() {
  return Object.keys(CONFIG.VOICES);
}

/**
 * 生成语音
 * @param {string} text - 要合成的文本
 * @param {string} outputPath - 输出 MP3 路径
 * @param {string} voiceName - 声音名称 (Adam, Rachel, etc.)
 * @returns {Promise<boolean>}
 */
async function generateSpeech(text, outputPath, voiceName = 'Adam') {
  if (!CONFIG.API_KEY) {
    console.log('   ⚠️ ElevenLabs API Key 未配置');
    return false;
  }

  const voiceId = CONFIG.VOICES[voiceName] || CONFIG.VOICES[CONFIG.DEFAULT_VOICE];

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      text: text,
      model_id: CONFIG.MODEL,
      voice_settings: {
        stability: 0.85,
        similarity_boost: 0.9,
        style: 0.1,
        use_speaker_boost: true,
        speed: 0.85
      }
    });

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
  getAvailableVoices,
  generateSpeech,
  getUsageInfo,
  CONFIG
};