/**
 * AI 智能视频风格生成器
 *
 * 功能：
 * 1. 从网站提取配色方案
 * 2. AI 分析品牌风格和情感
 * 3. 生成匹配的视频样式配置
 */

const https = require('fs');
const fs = require('fs');
const path = require('path');

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

// 基础风格模板
const BASE_STYLES = {
  modernTech: {
    name: 'Modern Tech',
    animation: { speed: 'fast', style: 'spring', transitions: 'smooth' },
    fonts: { title: 'Inter, sans-serif', body: 'Inter, sans-serif' }
  },
  corporate: {
    name: 'Corporate Professional',
    animation: { speed: 'medium', style: 'fade', transitions: 'smooth' },
    fonts: { title: 'Roboto, sans-serif', body: 'Roboto, sans-serif' }
  },
  vibrant: {
    name: 'Vibrant Energy',
    animation: { speed: 'fast', style: 'bounce', transitions: 'snappy' },
    fonts: { title: 'Poppins, sans-serif', body: 'Poppins, sans-serif' }
  },
  minimal: {
    name: 'Minimal Elegant',
    animation: { speed: 'slow', style: 'fade', transitions: 'elegant' },
    fonts: { title: 'Playfair Display, serif', body: 'Inter, sans-serif' }
  },
  friendly: {
    name: 'Friendly Warm',
    animation: { speed: 'medium', style: 'gentle', transitions: 'smooth' },
    fonts: { title: 'Nunito, sans-serif', body: 'Open Sans, sans-serif' }
  }
};

/**
 * 调用 AI API
 */
async function callAI(prompt, maxTokens = 800) {
  const https = require('https');
  if (!CONFIG.API_KEY) return null;

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: CONFIG.AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.4
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
 * AI 分析网站配色和品牌风格
 */
async function aiAnalyzeStyle(scrapedData, websiteType) {
  const colors = scrapedData.colorPalette || {};
  const brandColors = colors.brand || [];

  // 构建颜色信息
  const colorInfo = [];
  if (colors.primary) colorInfo.push(`Primary: ${colors.primary}`);
  if (colors.secondary) colorInfo.push(`Secondary: ${colors.secondary}`);
  if (brandColors.length > 0) {
    brandColors.slice(0, 5).forEach(c => {
      if (c.value !== 'check_image') {
        colorInfo.push(`${c.source}: ${c.value}`);
      }
    });
  }

  const prompt = `You are a brand design expert. Analyze the website's colors and create a matching video style.

=== WEBSITE INFO ===
Product: ${scrapedData.productName || 'Unknown'}
Type: ${websiteType || 'Unknown'}
Title: ${scrapedData.title || ''}

=== EXTRACTED COLORS ===
${colorInfo.length > 0 ? colorInfo.join('\n') : 'No colors extracted'}

=== CONTENT CONTEXT ===
${scrapedData.core_text?.substring(0, 300) || ''}

=== YOUR TASK ===
Based on the brand colors and content, determine:
1. The best video style template
2. Custom color palette that matches the brand
3. Animation style that fits the brand personality
4. Voice/tone for the video

=== OUTPUT FORMAT ===
Output ONLY valid JSON:
{
  "styleName": "Modern Tech",
  "styleTemplate": "modernTech",
  "colors": {
    "primary": "#9b4dff",
    "secondary": "#6b21a8",
    "accent": "#d480ff",
    "background": "#05010d",
    "text": "#ffffff",
    "gradient": "linear-gradient(135deg, #9b4dff 0%, #6b21a8 100%)"
  },
  "animation": {
    "speed": "fast",
    "style": "spring",
    "transitions": "smooth"
  },
  "personality": {
    "mood": "innovative",
    "energy": "high",
    "tone": "confident"
  },
  "reason": "Brief explanation of why this style fits the brand"
}`;

  return callAI(prompt);
}

/**
 * 智能生成视频风格
 */
async function generateVideoStyle(scrapedData, websiteType) {
  console.log('\n🎨 AI 生成视频风格...');

  // 尝试 AI 分析
  if (CONFIG.API_KEY && scrapedData.colorPalette) {
    console.log('   🤖 AI 分析品牌风格...');
    const aiStyle = await aiAnalyzeStyle(scrapedData, websiteType);

    if (aiStyle && aiStyle.colors) {
      console.log(`   ✅ 风格: ${aiStyle.styleName}`);
      console.log(`   🎨 主色: ${aiStyle.colors.primary}`);
      console.log(`   📝 理由: ${aiStyle.reason?.substring(0, 60)}...`);

      // 确保颜色适合视频使用
      const adjustedPrimary = ensureVideoSuitableColor(aiStyle.colors.primary, { fallback: '#9b4dff' });
      const adjustedSecondary = ensureVideoSuitableColor(aiStyle.colors.secondary || adjustBrightness(adjustedPrimary, -20));
      const adjustedAccent = ensureVideoSuitableColor(aiStyle.colors.accent || adjustBrightness(adjustedPrimary, 20));

      return {
        name: aiStyle.styleName,
        colors: {
          primary: adjustedPrimary,
          secondary: adjustedSecondary,
          accent: adjustedAccent,
          background: '#05010d',
          text: '#ffffff',
          gradient: `linear-gradient(135deg, ${adjustedPrimary} 0%, ${adjustedSecondary} 100%)`
        },
        animation: aiStyle.animation || BASE_STYLES.modernTech.animation,
        fonts: BASE_STYLES[aiStyle.styleTemplate]?.fonts || BASE_STYLES.modernTech.fonts,
        personality: aiStyle.personality,
        aiGenerated: true,
        reason: aiStyle.reason
      };
    }
  }

  // Fallback: 使用提取的颜色 + 网站类型模板
  const colors = scrapedData.colorPalette || {};
  const template = getStyleTemplateForType(websiteType);

  // 从 brand 数组中提取有效颜色（带优先级信息）
  const brandColors = (colors.brand || [])
    .filter(c => c.value !== 'check_image')
    .map(c => typeof c === 'object' ? c : { value: c, priority: 99, isBrandColor: true });

  // 智能选择最佳主色：优先选择高饱和度、适中亮度的颜色
  const selectBestPrimaryColor = (candidates) => {
    if (!candidates || candidates.length === 0) return null;

    // 计算每个颜色的"适合度"分数
    const scored = candidates.map(c => {
      const hex = typeof c === 'object' ? c.value : c;
      const sat = getSaturation(hex);
      const lum = getLuminance(hex);
      const priority = typeof c === 'object' ? (c.priority || 99) : 99;
      const isBrandColor = typeof c === 'object' ? c.isBrandColor : true;

      // 分数计算：
      // - 高饱和度 (>30%) 加分
      // - 适中亮度 (40-180) 加分
      // - 低优先级数字加分（CTA 按钮优先级最高）
      // - 标记为品牌色的加分
      let score = 0;
      if (sat > 0.3) score += 30;
      if (sat > 0.5) score += 20;
      if (lum > 40 && lum < 180) score += 30;
      if (priority < 5) score += (10 - priority) * 5;
      if (isBrandColor) score += 10;

      return { hex, score, sat, lum };
    });

    // 按分数排序，选择最高分的颜色
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.hex;
  };

  // 选择有效的视频颜色
  let primary = selectBestPrimaryColor(brandColors) ||
                pickValidColor(colors.primary, pickValidColor(brandColors.map(c => c.value || c), '#9b4dff'));
  let secondary = pickValidColor(colors.secondary, adjustBrightness(primary, -20));
  let accent = pickValidColor(colors.accent, adjustBrightness(primary, 20));

  // 确保颜色适合视频使用
  primary = ensureVideoSuitableColor(primary, { fallback: '#9b4dff' });
  secondary = ensureVideoSuitableColor(secondary);
  accent = ensureVideoSuitableColor(accent);

  if (isValidVideoColor(primary)) {
    console.log(`   ✅ 使用提取的配色: ${primary}`);
    return {
      name: template.name,
      colors: {
        primary,
        secondary,
        accent,
        background: '#05010d',
        text: '#ffffff',
        gradient: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`
      },
      animation: template.animation,
      fonts: template.fonts,
      aiGenerated: false
    };
  }

  // 完全 fallback
  console.log('   ⚠️ 使用默认风格');
  return {
    ...template,
    colors: {
      primary: '#9b4dff',
      secondary: '#6b21a8',
      accent: '#d480ff',
      background: '#05010d',
      text: '#ffffff',
      gradient: 'linear-gradient(135deg, #9b4dff 0%, #6b21a8 100%)'
    },
    aiGenerated: false
  };
}

/**
 * 根据网站类型获取风格模板
 */
function getStyleTemplateForType(websiteType) {
  const typeToStyle = {
    SAAS: BASE_STYLES.modernTech,
    ECOMMERCE: BASE_STYLES.vibrant,
    PORTFOLIO: BASE_STYLES.minimal,
    BLOG: BASE_STYLES.friendly,
    LANDING: BASE_STYLES.modernTech,
    CORPORATE: BASE_STYLES.corporate,
    TOOL: BASE_STYLES.modernTech,
  };

  return typeToStyle[websiteType] || BASE_STYLES.modernTech;
}

/**
 * 计算颜色亮度 (0-255)
 */
function getLuminance(hex) {
  if (!hex || !hex.startsWith('#')) return 128;
  const num = parseInt(hex.slice(1), 16);
  const r = num >> 16;
  const g = (num >> 8) & 0xFF;
  const b = num & 0xFF;
  // 使用感知亮度公式
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 计算颜色饱和度 (0-1)
 */
function getSaturation(hex) {
  if (!hex || !hex.startsWith('#')) return 0.5;
  const num = parseInt(hex.slice(1), 16);
  const r = num >> 16;
  const g = (num >> 8) & 0xFF;
  const b = num & 0xFF;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return 0; // 灰色

  const d = max - min;
  return l > 127.5 ? d / (510 - max - min) : d / (max + min);
}

/**
 * RGB 转 HSL
 */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

/**
 * HSL 转 RGB hex
 */
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/**
 * 确保颜色适合视频使用
 * - 提取的颜色可能太暗（如 GitHub #1E2327）或太亮
 * - 灰色系颜色需要增加饱和度以提升辨识度
 */
function ensureVideoSuitableColor(hex, options = {}) {
  if (!hex || !hex.startsWith('#')) return options.fallback || '#9b4dff';

  const luminance = getLuminance(hex);
  const saturation = getSaturation(hex);

  // 解析 RGB
  const num = parseInt(hex.slice(1), 16);
  let r = num >> 16;
  let g = (num >> 8) & 0xFF;
  let b = num & 0xFF;

  // 转换为 HSL 以便调整
  let [h, s, l] = rgbToHsl(r, g, b);

  // 视频背景通常是暗色（#05010d），主色需要有足够辨识度
  // 规则：
  // 1. 如果颜色太暗（亮度 < 15%），提亮到至少 30%
  // 2. 如果颜色太亮（亮度 > 85%），调暗到最多 70%
  // 3. 如果饱和度太低（< 30%），提升到至少 40% 以增加辨识度

  const MIN_LIGHTNESS = 30;  // 最低亮度 30%
  const MAX_LIGHTNESS = 70;  // 最高亮度 70%
  const MIN_SATURATION = 40; // 最低饱和度 40%

  let adjusted = false;

  // 调整亮度
  if (l < MIN_LIGHTNESS) {
    l = MIN_LIGHTNESS + (l / MIN_LIGHTNESS) * 10; // 渐进调整，保留一些原始特征
    adjusted = true;
  } else if (l > MAX_LIGHTNESS) {
    l = MAX_LIGHTNESS - ((100 - l) / (100 - MAX_LIGHTNESS)) * 10;
    adjusted = true;
  }

  // 调整饱和度
  if (s < MIN_SATURATION && s > 0) {
    s = MIN_SATURATION + (s / MIN_SATURATION) * 20;
    adjusted = true;
  } else if (s === 0 && l > 20 && l < 80) {
    // 纯灰色，给它一点颜色
    s = 50;
    // 根据亮度选择色相
    h = l > 50 ? 250 : 280; // 偏紫色调
    adjusted = true;
  }

  if (adjusted) {
    const newHex = hslToHex(h, s, l);
    console.log(`   🔧 颜色调整: ${hex} → ${newHex} (亮度 ${luminance.toFixed(0)}→${l.toFixed(0)}%, 饱和度 ${(saturation*100).toFixed(0)}→${s.toFixed(0)}%)`);
    return newHex;
  }

  return hex;
}

/**
 * 调整颜色亮度
 */
function adjustBrightness(hex, percent) {
  if (!hex || !hex.startsWith('#')) return hex;

  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));

  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`.toUpperCase();
}

/**
 * 验证颜色是否为标准格式 (hex 或 rgb/rgba)
 * 过滤掉现代 CSS 颜色格式如 oklch, oklab, lch, lab
 */
function isValidVideoColor(color) {
  if (!color || typeof color !== 'string') return false;
  // 只接受 hex 和 rgb/rgba 格式
  return /^#[0-9A-Fa-f]{3,8}$/.test(color) ||
         /^rgba?\(/.test(color);
}

/**
 * 从颜色列表中选择第一个有效的视频颜色
 */
function pickValidColor(colors, fallback) {
  if (Array.isArray(colors)) {
    for (const c of colors) {
      if (c && isValidVideoColor(c)) {
        return c;
      }
    }
  }
  if (isValidVideoColor(colors)) {
    return colors;
  }
  return fallback;
}

/**
 * 生成 CSS 变量
 */
function generateCSSVariables(style) {
  return `
:root {
  --color-primary: ${style.colors.primary};
  --color-secondary: ${style.colors.secondary};
  --color-accent: ${style.colors.accent};
  --color-background: ${style.colors.background};
  --color-text: ${style.colors.text};
  --gradient-main: ${style.colors.gradient};
}
  `.trim();
}

/**
 * 获取推荐的配音声音
 */
function getRecommendedVoice(style, language = 'en') {
  const moodToVoice = {
    innovative: { en: 'en-US-ChristopherNeural', zh: 'zh-CN-YunxiNeural' },
    confident: { en: 'en-US-ChristopherNeural', zh: 'zh-CN-YunxiNeural' },
    professional: { en: 'en-US-EricNeural', zh: 'zh-CN-YunfengNeural' },
    energetic: { en: 'en-US-TonyNeural', zh: 'zh-CN-YunyangNeural' },
    friendly: { en: 'en-US-GuyNeural', zh: 'zh-CN-YunjianNeural' },
    calm: { en: 'en-US-EricNeural', zh: 'zh-CN-YunxiaNeural' },
  };

  const mood = style.personality?.mood || 'innovative';
  return moodToVoice[mood]?.[language] || moodToVoice.innovative[language];
}

// 命令行测试
if (require.main === module) {
  const testScraped = {
    productName: 'GitHub Copilot',
    title: 'Your AI pair programmer',
    colorPalette: {
      primary: '#2da44e',
      secondary: '#238636',
      brand: [
        { source: 'navigation background', value: '#24292E' },
        { source: 'cta background', value: '#2DA44E' }
      ]
    },
    core_text: 'AI-powered code completion for developers'
  };

  generateVideoStyle(testScraped, 'SAAS').then(result => {
    console.log('\n结果:', JSON.stringify(result, null, 2));
  });
}

module.exports = {
  generateVideoStyle,
  aiAnalyzeStyle,
  generateCSSVariables,
  getRecommendedVoice,
  BASE_STYLES,
  // 导出颜色工具函数供测试使用
  getLuminance,
  getSaturation,
  ensureVideoSuitableColor,
  rgbToHsl,
  hslToHex
};