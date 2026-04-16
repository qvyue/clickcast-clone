/**
 * AI 智能视频风格生成器
 *
 * 功能：
 * 1. 从网站提取配色方案
 * 2. AI 分析品牌风格和情感
 * 3. 生成匹配的视频样式配置
 */

const fs = require('fs');
const path = require('path');

const { loadEnv } = require('../utils/env');
loadEnv();

const { callAI } = require('../utils/ai-client');
const {
  getLuminance,
  getSaturation,
  adjustBrightness,
  rgbToHsl,
  hslToHex,
  ensureVideoSuitableColor,
  isValidVideoColor,
  pickValidColor,
} = require('../utils/color');

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
  // Re-export color utilities for backward compatibility
  getLuminance,
  getSaturation,
  ensureVideoSuitableColor,
  rgbToHsl,
  hslToHex
};