/**
 * 视频样式配置
 *
 * 根据网站类型自动选择合适的视频风格
 */

const VIDEO_STYLES = {
  // SaaS 产品 - 现代科技风
  SAAS: {
    name: 'Modern Tech',
    colors: {
      primary: '#9b4dff',      // 紫色
      secondary: '#6b21a8',
      accent: '#d480ff',
      background: '#05010d',
      text: '#ffffff'
    },
    fonts: {
      title: 'Inter, sans-serif',
      body: 'Inter, sans-serif'
    },
    animation: {
      speed: 'fast',
      style: 'spring',
      transitions: 'smooth'
    },
    voice: {
      tone: 'professional',
      speed: 1.0
    }
  },

  // 电商 - 活力促销风
  ECOMMERCE: {
    name: 'Vibrant Sale',
    colors: {
      primary: '#ff6b35',      // 橙色
      secondary: '#f7931e',
      accent: '#ffd700',
      background: '#1a1a1a',
      text: '#ffffff'
    },
    fonts: {
      title: 'Poppins, sans-serif',
      body: 'Poppins, sans-serif'
    },
    animation: {
      speed: 'medium',
      style: 'bounce',
      transitions: 'snappy'
    },
    voice: {
      tone: 'enthusiastic',
      speed: 1.1
    }
  },

  // 作品集 - 简约艺术风
  PORTFOLIO: {
    name: 'Minimal Art',
    colors: {
      primary: '#ffffff',
      secondary: '#e0e0e0',
      accent: '#333333',
      background: '#0a0a0a',
      text: '#ffffff'
    },
    fonts: {
      title: 'Playfair Display, serif',
      body: 'Inter, sans-serif'
    },
    animation: {
      speed: 'slow',
      style: 'fade',
      transitions: 'elegant'
    },
    voice: {
      tone: 'calm',
      speed: 0.9
    }
  },

  // 博客 - 温暖故事风
  BLOG: {
    name: 'Warm Story',
    colors: {
      primary: '#4a90d9',      // 蓝色
      secondary: '#2c5282',
      accent: '#63b3ed',
      background: '#1a202c',
      text: '#f7fafc'
    },
    fonts: {
      title: 'Merriweather, serif',
      body: 'Open Sans, sans-serif'
    },
    animation: {
      speed: 'slow',
      style: 'gentle',
      transitions: 'smooth'
    },
    voice: {
      tone: 'friendly',
      speed: 0.95
    }
  },

  // 落地页 - 冲击力强
  LANDING: {
    name: 'Impact',
    colors: {
      primary: '#00d9ff',      // 青色
      secondary: '#0ea5e9',
      accent: '#38bdf8',
      background: '#0c1222',
      text: '#ffffff'
    },
    fonts: {
      title: 'Montserrat, sans-serif',
      body: 'Inter, sans-serif'
    },
    animation: {
      speed: 'fast',
      style: 'spring',
      transitions: 'dynamic'
    },
    voice: {
      tone: 'confident',
      speed: 1.05
    }
  },

  // 企业官网 - 专业稳重
  CORPORATE: {
    name: 'Professional',
    colors: {
      primary: '#1e40af',      // 深蓝
      secondary: '#1e3a8a',
      accent: '#3b82f6',
      background: '#0f172a',
      text: '#f1f5f9'
    },
    fonts: {
      title: 'Roboto, sans-serif',
      body: 'Roboto, sans-serif'
    },
    animation: {
      speed: 'medium',
      style: 'professional',
      transitions: 'smooth'
    },
    voice: {
      tone: 'trustworthy',
      speed: 0.95
    }
  },

  // 工具类 - 高效实用
  TOOL: {
    name: 'Efficient',
    colors: {
      primary: '#10b981',      // 绿色
      secondary: '#059669',
      accent: '#34d399',
      background: '#064e3b',
      text: '#ffffff'
    },
    fonts: {
      title: 'JetBrains Mono, monospace',
      body: 'Inter, sans-serif'
    },
    animation: {
      speed: 'fast',
      style: 'snappy',
      transitions: 'quick'
    },
    voice: {
      tone: 'clear',
      speed: 1.0
    }
  },

  // 默认风格
  DEFAULT: {
    name: 'Default',
    colors: {
      primary: '#9b4dff',
      secondary: '#6b21a8',
      accent: '#d480ff',
      background: '#05010d',
      text: '#ffffff'
    },
    fonts: {
      title: 'Inter, sans-serif',
      body: 'Inter, sans-serif'
    },
    animation: {
      speed: 'medium',
      style: 'spring',
      transitions: 'smooth'
    },
    voice: {
      tone: 'professional',
      speed: 1.0
    }
  }
};

/**
 * 根据网站类型获取样式配置
 */
function getStyleForType(websiteType) {
  return VIDEO_STYLES[websiteType] || VIDEO_STYLES.DEFAULT;
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
}
  `.trim();
}

/**
 * 获取推荐的配音声音
 */
function getRecommendedVoice(style, language = 'en') {
  const voiceMap = {
    professional: {
      en: 'en-US-ChristopherNeural',
      zh: 'zh-CN-YunxiNeural'
    },
    enthusiastic: {
      en: 'en-US-TonyNeural',
      zh: 'zh-CN-YunyangNeural'
    },
    calm: {
      en: 'en-US-EricNeural',
      zh: 'zh-CN-YunxiaNeural'
    },
    friendly: {
      en: 'en-US-GuyNeural',
      zh: 'zh-CN-YunjianNeural'
    },
    confident: {
      en: 'en-US-ChristopherNeural',
      zh: 'zh-CN-YunxiNeural'
    },
    trustworthy: {
      en: 'en-US-EricNeural',
      zh: 'zh-CN-YunfengNeural'
    },
    clear: {
      en: 'en-US-GuyNeural',
      zh: 'zh-CN-YunxiNeural'
    }
  };

  const tone = style.voice?.tone || 'professional';
  return voiceMap[tone]?.[language] || voiceMap.professional[language];
}

module.exports = {
  VIDEO_STYLES,
  getStyleForType,
  generateCSSVariables,
  getRecommendedVoice
};