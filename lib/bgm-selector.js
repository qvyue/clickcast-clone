/**
 * AI 智能 BGM 选择系统
 *
 * 功能：
 * 1. AI 分析网站内容和情绪，智能推荐音乐
 * 2. 本地音乐库管理
 * 3. 自动调整音量和时长
 * 4. 节奏匹配视频场景
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// 手动加载 .env
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

const CONFIG = {
  API_KEY: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
  API_BASE_URL: process.env.API_BASE_URL || 'https://api.deepseek.com',
  AI_MODEL: process.env.AI_MODEL || 'deepseek-chat',
};

// BGM 音乐库配置 - 丰富的音乐库供 AI 选择
const BGM_LIBRARY = {
  // 科技/SaaS 风格
  tech: [
    { id: 'tech-01', name: 'Digital Dreams', mood: 'innovative', energy: 'medium', bpm: 120, description: 'Futuristic synth sounds, perfect for tech products and innovation' },
    { id: 'tech-02', name: 'Future Forward', mood: 'confident', energy: 'high', bpm: 128, description: 'Driving electronic beat, confident and ambitious tone' },
    { id: 'tech-03', name: 'Startup Life', mood: 'inspiring', energy: 'medium', bpm: 110, description: 'Uplifting melody, inspiring and motivational' },
    { id: 'tech-04', name: 'Code Flow', mood: 'focused', energy: 'medium', bpm: 105, description: 'Steady rhythm, good for developer tools and productivity apps' },
  ],

  // 企业/专业风格
  corporate: [
    { id: 'corp-01', name: 'Business Drive', mood: 'professional', energy: 'medium', bpm: 100, description: 'Clean corporate sound, trustworthy and reliable' },
    { id: 'corp-02', name: 'Success Story', mood: 'confident', energy: 'medium', bpm: 95, description: 'Achievement and success theme, positive outcome' },
    { id: 'corp-03', name: 'Growth Path', mood: 'optimistic', energy: 'medium', bpm: 105, description: 'Progressive and forward-moving, business growth' },
    { id: 'corp-04', name: 'Trust Building', mood: 'trustworthy', energy: 'low', bpm: 85, description: 'Calm and steady, builds confidence and trust' },
  ],

  // 电商/活力风格
  ecommerce: [
    { id: 'ecom-01', name: 'Shopping Spree', mood: 'energetic', energy: 'high', bpm: 130, description: 'Upbeat and fun, perfect for shopping and deals' },
    { id: 'ecom-02', name: 'Deal Alert', mood: 'exciting', energy: 'high', bpm: 140, description: 'High energy, creates urgency and excitement' },
    { id: 'ecom-03', name: 'Trendy Vibes', mood: 'modern', energy: 'high', bpm: 125, description: 'Contemporary and stylish, fashion and trends' },
    { id: 'ecom-04', name: 'Summer Sale', mood: 'happy', energy: 'high', bpm: 135, description: 'Bright and cheerful, seasonal promotions' },
  ],

  // 创意/艺术风格
  creative: [
    { id: 'create-01', name: 'Artistic Flow', mood: 'inspiring', energy: 'low', bpm: 85, description: 'Gentle and artistic, portfolio and creative work' },
    { id: 'create-02', name: 'Dreamy Scenes', mood: 'peaceful', energy: 'low', bpm: 75, description: 'Ambient and ethereal, artistic and dreamy' },
    { id: 'create-03', name: 'Minimal Beauty', mood: 'calm', energy: 'low', bpm: 70, description: 'Minimal and elegant, sophisticated designs' },
    { id: 'create-04', name: 'Creative Spark', mood: 'creative', energy: 'medium', bpm: 95, description: 'Playful and creative, design and art' },
  ],

  // 工具/效率风格
  utility: [
    { id: 'util-01', name: 'Focus Mode', mood: 'productive', energy: 'medium', bpm: 100, description: 'Concentrated and efficient, productivity tools' },
    { id: 'util-02', name: 'Quick Steps', mood: 'efficient', energy: 'medium', bpm: 115, description: 'Fast and purposeful, getting things done' },
    { id: 'util-03', name: 'Get It Done', mood: 'determined', energy: 'medium', bpm: 110, description: 'Motivated and determined, task completion' },
    { id: 'util-04', name: 'Smooth Workflow', mood: 'organized', energy: 'low', bpm: 90, description: 'Organized and smooth, process and workflow' },
  ],

  // 博客/故事风格
  storytelling: [
    { id: 'story-01', name: 'Warm Story', mood: 'friendly', energy: 'low', bpm: 80, description: 'Warm and inviting, storytelling and blogs' },
    { id: 'story-02', name: 'Journey', mood: 'inspiring', energy: 'medium', bpm: 90, description: 'Narrative journey, personal stories' },
    { id: 'story-03', name: 'Reflection', mood: 'thoughtful', energy: 'low', bpm: 70, description: 'Contemplative and thoughtful, essays and articles' },
  ],

  // 通用背景音乐
  general: [
    { id: 'gen-01', name: 'Smooth Background', mood: 'neutral', energy: 'low', bpm: 90, description: 'Neutral background, works with most content' },
    { id: 'gen-02', name: 'Light Moments', mood: 'positive', energy: 'low', bpm: 95, description: 'Light and positive, general purpose' },
    { id: 'gen-03', name: 'Gentle Progress', mood: 'steady', energy: 'low', bpm: 85, description: 'Steady progress, reliable choice' },
  ],
};

// 获取所有音乐的扁平列表
function getAllTracks() {
  const allTracks = [];
  for (const [style, tracks] of Object.entries(BGM_LIBRARY)) {
    tracks.forEach(track => {
      allTracks.push({ ...track, style });
    });
  }
  return allTracks;
}

// 网站类型到音乐风格的映射 (fallback 用)
const WEBSITE_TO_BGM_STYLE = {
  SAAS: 'tech',
  ECOMMERCE: 'ecommerce',
  PORTFOLIO: 'creative',
  BLOG: 'storytelling',
  LANDING: 'tech',
  CORPORATE: 'corporate',
  TOOL: 'utility',
  DEFAULT: 'general',
};

// 免费音乐源 URLs (royalty-free)
const FREE_MUSIC_SOURCES = {
  'tech-01': 'https://www.bensound.com/bensound-music/bensound-digitalworld.mp3',
  'tech-02': 'https://www.bensound.com/bensound-music/bensound-scifi.mp3',
  'tech-03': 'https://www.bensound.com/bensound-music/bensound-energycrazysci-fi.mp3',
  'corp-01': 'https://www.bensound.com/bensound-music/bensound-corporate.mp3',
  'corp-02': 'https://www.bensound.com/bensound-music/bensound-roses.mp3',
  'corp-03': 'https://www.bensound.com/bensound-music/bensound-tomorrow.mp3',
  'ecom-01': 'https://www.bensound.com/bensound-music/bensound-summer.mp3',
  'ecom-02': 'https://www.bensound.com/bensound-music/bensound-happyrock.mp3',
  'ecom-03': 'https://www.bensound.com/bensound-music/bensound-funkyelement.mp3',
  'create-01': 'https://www.bensound.com/bensound-music/bensound-slowmotion.mp3',
  'create-02': 'https://www.bensound.com/bensound-music/bensound-dreamy.mp3',
  'create-03': 'https://www.bensound.com/bensound-music/bensound-relaxing.mp3',
  'util-01': 'https://www.bensound.com/bensound-music/bensound-focus.mp3',
  'util-02': 'https://www.bensound.com/bensound-music/bensound-pumped.mp3',
  'util-03': 'https://www.bensound.com/bensound-music/bensound-actionable.mp3',
  'gen-01': 'https://www.bensound.com/bensound-music/bensound-slowlife.mp3',
  'gen-02': 'https://www.bensound.com/bensound-music/bensound-ukulele.mp3',
  'gen-03': 'https://www.bensound.com/bensound-music/bensound-acousticbreeze.mp3',
};

/**
 * 调用 AI API
 */
async function callAI(prompt, maxTokens = 500) {
  if (!CONFIG.API_KEY) return null;

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: CONFIG.AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.3
    });

    const url = new URL(`${CONFIG.API_BASE_URL}/v1/chat/completions`);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.choices && json.choices[0]) {
            const content = json.choices[0].message.content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              resolve(JSON.parse(jsonMatch[0]));
            } else {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });
}

/**
 * AI 分析网站内容，智能选择最合适的 BGM
 */
async function aiSelectBGM(scrapedData, websiteType, videoDuration) {
  const allTracks = getAllTracks();

  // 构建音乐选项列表（简化版给 AI 选择）
  const trackOptions = allTracks.map(t => ({
    id: t.id,
    name: t.name,
    mood: t.mood,
    energy: t.energy,
    style: t.style,
    description: t.description
  }));

  // 构建上下文
  const context = [];

  if (scrapedData.productName) {
    context.push(`Product: ${scrapedData.productName}`);
  }
  if (scrapedData.title) {
    context.push(`Title: ${scrapedData.title}`);
  }
  if (scrapedData.description) {
    context.push(`Description: ${scrapedData.description}`);
  }
  if (scrapedData.core_text) {
    context.push(`Content: ${scrapedData.core_text.substring(0, 500)}`);
  }
  if (scrapedData.industryResearch?.keywords) {
    const kw = scrapedData.industryResearch.keywords;
    if (kw.industry?.length > 0) {
      context.push(`Industry: ${kw.industry.join(', ')}`);
    }
    if (kw.trends?.length > 0) {
      context.push(`Market Trends: ${kw.trends.slice(0, 3).join(', ')}`);
    }
  }

  const prompt = `You are a music supervisor for marketing videos. Analyze the website content and select the BEST background music.

=== WEBSITE INFO ===
Type: ${websiteType || 'Unknown'}
${context.join('\n')}

=== AVAILABLE MUSIC TRACKS ===
${JSON.stringify(trackOptions, null, 2)}

=== SELECTION CRITERIA ===
1. Match the MOOD of the content (innovative tech → confident/inspiring, e-commerce → energetic, etc.)
2. Match the ENERGY level (fast-paced product → high energy, calm service → low energy)
3. Consider target audience (developers → focused/productive, consumers → happy/energetic)
4. Match the industry vibe (tech startup → tech style, corporate → corporate style)

=== OUTPUT FORMAT ===
Output ONLY valid JSON:
{
  "selectedTrackId": "tech-01",
  "reason": "Brief explanation why this track fits",
  "moodMatch": "innovative",
  "energyLevel": "medium",
  "suggestedVolume": 0.15,
  "confidence": 0.9
}`;

  return callAI(prompt);
}

/**
 * 推荐背景音乐 (使用 AI 智能选择)
 */
async function recommendBGM(websiteType, videoDuration, scrapedData = null) {
  // 如果有 scrapedData，使用 AI 智能选择
  if (scrapedData && CONFIG.API_KEY) {
    console.log('   🤖 AI 正在分析内容选择最佳 BGM...');
    const aiResult = await aiSelectBGM(scrapedData, websiteType, videoDuration);

    if (aiResult && aiResult.selectedTrackId) {
      // 查找选中的音乐
      const allTracks = getAllTracks();
      const selectedTrack = allTracks.find(t => t.id === aiResult.selectedTrackId);

      if (selectedTrack) {
        console.log(`   ✅ AI 选择: ${selectedTrack.name}`);
        console.log(`   📝 理由: ${aiResult.reason || '匹配内容和情绪'}`);

        return {
          track: selectedTrack,
          style: selectedTrack.style,
          recommendedVolume: aiResult.suggestedVolume || calculateOptimalVolume(selectedTrack.energy),
          shouldLoop: videoDuration / 30 > 60,
          fadeIn: 15,
          fadeOut: 30,
          aiReason: aiResult.reason,
          confidence: aiResult.confidence || 0.8
        };
      }
    }
  }

  // Fallback: 使用网站类型映射
  const style = WEBSITE_TO_BGM_STYLE?.[websiteType] || 'general';
  const tracks = BGM_LIBRARY[style];
  const selectedTrack = tracks[0];

  return {
    track: selectedTrack,
    style: style,
    recommendedVolume: calculateOptimalVolume(selectedTrack.energy),
    shouldLoop: videoDuration / 30 > 60,
    fadeIn: 15,
    fadeOut: 30
  };
}

/**
 * 计算最优音量
 */
function calculateOptimalVolume(energy) {
  const volumes = {
    low: 0.12,
    medium: 0.15,
    high: 0.18,
  };
  return volumes[energy] || 0.15;
}

/**
 * 下载 BGM 文件
 */
async function downloadBGM(trackId, outputDir = './public') {
  const url = FREE_MUSIC_SOURCES[trackId];
  const defaultBGM = 'bensound-slowlife.mp3';
  const defaultPath = path.join(outputDir, defaultBGM);

  // 如果默认音乐存在，直接使用
  if (fs.existsSync(defaultPath)) {
    console.log(`   ✅ 使用本地 BGM: ${defaultBGM}`);
    return defaultPath;
  }

  // 尝试下载
  if (!url) {
    console.log(`⚠️ 未找到音乐 ${trackId}`);
    return defaultPath;
  }

  const outputPath = path.join(outputDir, `bgm-${trackId}.mp3`);

  if (fs.existsSync(outputPath)) {
    console.log(`✅ BGM 已存在: ${outputPath}`);
    return outputPath;
  }

  console.log(`   ⚠️ 在线下载不可用，使用默认音乐`);
  return defaultPath;
}

/**
 * AI 分析并选择最佳 BGM
 */
async function selectBGMForVideo(websiteType, videoDuration, scrapedData = null) {
  console.log('\n🎵 AI 智能选择背景音乐...');

  // 使用 AI 推荐音乐
  const recommendation = await recommendBGM(websiteType, videoDuration, scrapedData);

  console.log(`   🎼 风格: ${recommendation.style}`);
  console.log(`   🎶 曲目: ${recommendation.track.name}`);
  console.log(`   🔊 音量: ${recommendation.recommendedVolume}`);
  console.log(`   ⚡ 能量: ${recommendation.track.energy}`);
  console.log(`   😌 情绪: ${recommendation.track.mood}`);

  // 下载/获取音乐文件
  const bgmPath = await downloadBGM(recommendation.track.id);

  return {
    ...recommendation,
    path: bgmPath,
    filename: path.basename(bgmPath),
  };
}

/**
 * 获取音频时长
 */
function getAudioDuration(filePath) {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return parseFloat(result.trim());
  } catch (e) {
    return 60; // 默认 60 秒
  }
}

/**
 * 生成 BGM 配置供 Remotion 使用
 */
function generateBGMConfig(bgmInfo, videoDuration) {
  const audioDuration = getAudioDuration(bgmInfo.path);
  const videoSeconds = videoDuration / 30;

  return {
    src: bgmInfo.filename,
    volume: bgmInfo.recommendedVolume,
    loop: audioDuration < videoSeconds,
    fadeInFrames: bgmInfo.fadeIn,
    fadeOutFrames: bgmInfo.fadeOut,
    duration: Math.min(audioDuration, videoSeconds),
  };
}

// 命令行测试
if (require.main === module) {
  const args = process.argv.slice(2);
  const websiteType = args[0] || 'SAAS';

  selectBGMForVideo(websiteType, 600).then(result => {
    console.log('\n结果:', JSON.stringify(result, null, 2));
  });
}

module.exports = {
  BGM_LIBRARY,
  WEBSITE_TO_BGM_STYLE,
  recommendBGM,
  downloadBGM,
  selectBGMForVideo,
  generateBGMConfig,
  getAudioDuration,
};