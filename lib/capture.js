// capture.js - AI 智能截图 + 深度内容提取
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const { loadEnv } = require('../utils/env');
loadEnv();

const { callAI } = require('../utils/ai-client');

/**
 * 计算两个文本的相似度（基于词组重合度）
 * 返回 0-1 之间的值，1 表示完全相同
 */
function calculateTextSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  if (text1 === text2) return 1;

  // 分词并转为小写
  const words1 = text1.split(/\s+/).filter(w => w.length > 2);
  const words2 = text2.split(/\s+/).filter(w => w.length > 2);

  if (words1.length === 0 || words2.length === 0) return 0;

  // 计算交集
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = [...set1].filter(w => set2.has(w));

  // 使用 Jaccard 相似度
  const union = new Set([...set1, ...set2]);
  return intersection.length / union.size;
}

/**
 * 生成可视化 HTML
 */
function generateVisualizationHTML(candidates, selectedIds, screenshots, pageContent) {
  const selectedSet = new Set(selectedIds);

  // 按页面位置从上到下排序
  const sortedCandidates = [...candidates].sort((a, b) => (a.top || 0) - (b.top || 0));

  const blocksHTML = sortedCandidates.map(c => {
    const isSelected = selectedSet.has(c.id);
    const screenshot = screenshots.find(s => s.id === c.id);
    const borderColor = isSelected ? '#ef4444' : '#eab308';
    const statusBadge = isSelected
      ? '<span style="background:#ef4444;padding:2px 8px;border-radius:4px;font-size:12px;">AI选中</span>'
      : '<span style="background:#eab308;padding:2px 8px;border-radius:4px;font-size:12px;">AI丢弃</span>';

    return `
    <div style="background:#1e293b;border-radius:12px;overflow:hidden;margin-bottom:20px;border:2px solid ${borderColor};">
      <div style="background:${isSelected ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)'};padding:15px;display:flex;align-items:center;gap:15px;">
        <span style="background:#0f172a;padding:4px 12px;border-radius:20px;font-weight:bold;">#${c.id}</span>
        <span style="background:#7c3aed;padding:4px 12px;border-radius:20px;font-size:12px;">${c.suggestedType.toUpperCase()}</span>
        <span style="flex:1;font-weight:500;">${c.heading || c.textSummary?.substring(0, 50) || 'N/A'}</span>
        <span style="color:#94a3b8;font-size:13px;">${c.width} × ${c.height}</span>
        ${statusBadge}
      </div>
      ${screenshot ? `
      <div style="padding:15px;">
        <img src="candidate_${c.id}.png" style="max-width:100%;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);" />
      </div>
      ` : '<div style="padding:15px;color:#94a3b8;">截图失败</div>'}
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>截图区块可视化 - ${pageContent.productName || pageContent.seo?.title || 'Unknown'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #fff; padding: 20px; }
    h1 { text-align: center; margin-bottom: 10px; }
    .url { text-align: center; color: #94a3b8; margin-bottom: 20px; }
    .legend { display: flex; justify-content: center; gap: 30px; margin-bottom: 30px; }
    .legend-item { display: flex; align-items: center; gap: 8px; }
    .legend-box { width: 30px; height: 20px; border-radius: 4px; }
    .container { max-width: 1400px; margin: 0 auto; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
    .stat { text-align: center; padding: 20px; background: #1e293b; border-radius: 12px; }
    .stat-number { font-size: 48px; font-weight: bold; }
    .stat-label { color: #94a3b8; margin-top: 5px; }
  </style>
</head>
<body>
  <h1>🔍 截图区块可视化分析</h1>
  <p class="url">${pageContent.url || ''}</p>

  <div class="legend">
    <div class="legend-item">
      <div class="legend-box" style="background:#ef4444;"></div>
      <span>AI 选中的 (${selectedIds.length}个)</span>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background:#eab308;"></div>
      <span>AI 丢弃的 (${candidates.length - selectedIds.length}个)</span>
    </div>
  </div>

  <div class="container">
    <div class="stats">
      <div class="stat">
        <div class="stat-number" style="color:#fff;">${candidates.length}</div>
        <div class="stat-label">候选区块总数</div>
      </div>
      <div class="stat">
        <div class="stat-number" style="color:#ef4444;">${selectedIds.length}</div>
        <div class="stat-label">AI 选中</div>
      </div>
      <div class="stat">
        <div class="stat-number" style="color:#eab308;">${candidates.length - selectedIds.length}</div>
        <div class="stat-label">AI 丢弃</div>
      </div>
    </div>

    ${blocksHTML}
  </div>
</body>
</html>`;
}

/**
 * 读取用户自定义描述
 */
function loadCustomDescription() {
  const descPath = path.join(__dirname, 'public', 'custom-description.txt');
  if (fs.existsSync(descPath)) {
    try {
      return fs.readFileSync(descPath, 'utf-8').trim();
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * 使用 AI 分析用户描述，提取截图关键词
 */
async function analyzeUserDescriptionForScreenshots(description, pageContent) {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = `Analyze the website owner's description and determine what content should be captured in screenshots for a marketing video.

Website Owner's Description:
"${description}"

Website Content Summary:
- Title: ${pageContent.seo?.title || 'N/A'}
- Product: ${pageContent.productName || 'N/A'}
- H1 Headings: ${(pageContent.headings?.h1 || []).slice(0, 3).join(', ')}
- H2 Headings: ${(pageContent.headings?.h2 || []).slice(0, 5).join(', ')}
- Features: ${(pageContent.features || []).slice(0, 5).join(', ')}
- CTA Buttons: ${(pageContent.ctaTexts || []).slice(0, 3).join(', ')}

Based on the owner's description, determine:
1. What key features/benefits should be highlighted in screenshots?
2. What sections of the website should be captured?
3. What keywords should we search for in the page?

Output JSON only:
{
  "keyPoints": ["point1", "point2", "point3"],
  "searchKeywords": ["keyword1", "keyword2"],
  "screenshotFocus": ["hero", "features", "pricing"],
  "priorityElements": ["element description to find"]
}`;

  return callAI(prompt, { maxTokens: 500, temperature: 0.3 });
}

/**
 * 深度提取网页内容 - 用于 AI 分析
 */
async function extractPageContent(page) {
  return await page.evaluate(() => {
    const getText = (selector) => {
      const els = document.querySelectorAll(selector);
      return Array.from(els)
        .map(el => (el.innerText || el.textContent || '').trim())
        .filter(t => t.length > 0 && t.length < 500);
    };

    const getAttr = (selector, attr) => {
      const el = document.querySelector(selector);
      return el ? el.getAttribute(attr) || '' : '';
    };

    // 颜色提取辅助函数
    const isValidColor = (color) => {
      if (!color || typeof color !== 'string') return false;
      return /^(#[0-9A-Fa-f]{3,8}|rgb|rgba|hsl|hsla)/.test(color) ||
             /^[a-zA-Z]+$/.test(color);
    };

    const normalizeColor = (color) => {
      if (!color) return null;
      if (color.startsWith('#')) {
        return color.toUpperCase();
      }
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`.toUpperCase();
      }
      return color;
    };

    const adjustBrightness = (hex, percent) => {
      if (!hex || !hex.startsWith('#')) return hex;
      const num = parseInt(hex.slice(1), 16);
      const r = Math.min(255, Math.max(0, (num >> 16) + percent));
      const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
      const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
      return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`.toUpperCase();
    };

    const extractColorPalette = () => {
      const colors = {
        primary: null,
        secondary: null,
        accent: null,
        background: null,
        text: null,
        brand: [],
        css: [],
      };

      // 辅助函数：计算颜色饱和度
      const getSaturation = (hex) => {
        if (!hex || !hex.startsWith('#')) return 0;
        const num = parseInt(hex.slice(1), 16);
        const r = num >> 16;
        const g = (num >> 8) & 0xFF;
        const b = num & 0xFF;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max === min) return 0;
        const l = (max + min) / 2;
        return l > 127.5 ? (max - min) / (510 - max - min) : (max - min) / (max + min);
      };

      // 辅助函数：计算颜色亮度
      const getLuminance = (hex) => {
        if (!hex || !hex.startsWith('#')) return 0;
        const num = parseInt(hex.slice(1), 16);
        const r = num >> 16;
        const g = (num >> 8) & 0xFF;
        const b = num & 0xFF;
        return 0.299 * r + 0.587 * g + 0.114 * b;
      };

      // 辅助函数：判断颜色是否适合作为视频主色（饱和度高、亮度适中）
      const isGoodBrandColor = (hex) => {
        const sat = getSaturation(hex);
        const lum = getLuminance(hex);
        // 饱和度 > 30%，亮度在 40-200 之间的颜色更适合作为品牌主色
        return sat > 0.3 && lum > 40 && lum < 200;
      };

      // 1. 从 CSS 变量提取
      const cssVars = ['--primary', '--secondary', '--accent', '--brand', '--color', '--bg', '--background', '--text'];
      const rootStyles = getComputedStyle(document.documentElement);

      cssVars.forEach(varName => {
        const variations = [varName, `${varName}-color`, `${varName}-1`];
        for (const v of variations) {
          try {
            const value = rootStyles.getPropertyValue(v).trim();
            if (value && isValidColor(value)) {
              colors.css.push({ source: `CSS变量 ${v}`, value: normalizeColor(value) });
              break;
            }
          } catch (e) {}
        }
      });

      // 2. 从主题色 meta 标签提取（通常是导航栏颜色，不一定适合作为品牌主色）
      const themeColor = document.querySelector('meta[name="theme-color"]');
      if (themeColor) {
        const color = themeColor.getAttribute('content');
        if (color && isValidColor(color)) {
          const normalized = normalizeColor(color);
          colors.brand.push({
            source: 'theme-color meta',
            value: normalized,
            isBrandColor: isGoodBrandColor(normalized) // 标记是否适合作为品牌色
          });
        }
      }

      // 3. 从主要 UI 元素提取颜色（优先级：CTA > hero > link > heading > navigation）
      const colorSources = [
        { selector: 'button, .btn, [class*="button"], [class*="cta"]', type: 'cta', priority: 1 }, // 最高优先级
        { selector: '.hero, .banner, [class*="hero"]', type: 'hero', priority: 2 },
        { selector: 'a, [class*="link"]', type: 'link', priority: 3 },
        { selector: 'h1, h2, .title', type: 'heading', priority: 4 },
        { selector: 'header, nav, .navbar', type: 'navigation', priority: 5 }, // 最低优先级
      ];

      colorSources.forEach(({ selector, type, priority }) => {
        const el = document.querySelector(selector);
        if (el) {
          const styles = getComputedStyle(el);
          const bgColor = styles.backgroundColor;
          const textColor = styles.color;

          if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            const normalized = normalizeColor(bgColor);
            if (normalized && !colors.brand.find(c => c.value === normalized)) {
              colors.brand.push({
                source: `${type} background`,
                value: normalized,
                priority,
                isBrandColor: isGoodBrandColor(normalized)
              });
            }
          }
          if (textColor && textColor !== 'rgba(0, 0, 0, 0)') {
            const normalized = normalizeColor(textColor);
            if (normalized && !colors.brand.find(c => c.value === normalized)) {
              colors.brand.push({
                source: `${type} text`,
                value: normalized,
                priority,
                isBrandColor: isGoodBrandColor(normalized)
              });
            }
          }
        }
      });

      // 4. 从 Logo 提取 (如果有 canvas)
      const logos = document.querySelectorAll('img[alt*="logo"], img[class*="logo"], [class*="logo"] img');
      if (logos.length > 0) {
        colors.brand.push({ source: 'logo detected', value: 'check_image' });
      }

      // 5. 智能选择最佳配色
      // 优先选择：1) 适合作为品牌色（高饱和度、适中亮度）2) 优先级高的元素（CTA > hero > 其他）
      const validColors = colors.brand.filter(c => c.value !== 'check_image');

      // 按"品牌色适合度"和"优先级"排序
      const sortedColors = validColors.sort((a, b) => {
        // 先按品牌色适合度排序（true 排在前面）
        if (a.isBrandColor !== b.isBrandColor) {
          return a.isBrandColor ? -1 : 1;
        }
        // 再按优先级排序（数字小的排前面）
        const priorityA = a.priority || 99;
        const priorityB = b.priority || 99;
        return priorityA - priorityB;
      });

      // 选择主色、次色、强调色
      const uniqueSorted = [];
      const seenValues = new Set();
      for (const c of sortedColors) {
        if (!seenValues.has(c.value)) {
          uniqueSorted.push(c.value);
          seenValues.add(c.value);
        }
      }

      if (uniqueSorted.length > 0) {
        colors.primary = uniqueSorted[0];
        colors.secondary = uniqueSorted[1] || adjustBrightness(uniqueSorted[0], -20);
        colors.accent = uniqueSorted[2] || adjustBrightness(uniqueSorted[0], 20);
      }

      return colors;
    };

    // 1. SEO Meta 信息
    const seo = {
      title: document.title,
      description: getAttr('meta[name="description"]', 'content') ||
                   getAttr('meta[property="og:description"]', 'content'),
      keywords: getAttr('meta[name="keywords"]', 'content'),
      ogTitle: getAttr('meta[property="og:title"]', 'content'),
      ogDescription: getAttr('meta[property="og:description"]', 'content'),
      twitterTitle: getAttr('meta[name="twitter:title"]', 'content'),
      twitterDescription: getAttr('meta[name="twitter:description"]', 'content'),
    };

    // 2. 结构化数据 (JSON-LD)
    const jsonLd = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        jsonLd.push(JSON.parse(script.textContent));
      } catch (e) {}
    });

    // 3. 标题层级
    const headings = {
      h1: getText('h1'),
      h2: getText('h2'),
      h3: getText('h3'),
      h4: getText('h4'),
    };

    // 4. 正文段落
    const paragraphs = getText('p').slice(0, 20);

    // 5. 列表项 (通常是功能点)
    const listItems = getText('li').slice(0, 30);

    // 6. CTA / 按钮文字
    const ctaTexts = getText('button, a[class*="btn"], a[class*="button"], [class*="cta"]').slice(0, 10);

    // 7. 产品特性区域 (常见命名)
    const featureSelectors = [
      '[class*="feature"]', '[class*="benefit"]', '[class*="why-choose"]',
      '[class*="advantage"]', '[class*="highlight"]', '[class*="value"]'
    ];
    const features = [];
    featureSelectors.forEach(sel => {
      getText(sel).forEach(t => {
        if (t.length > 10 && t.length < 200) features.push(t);
      });
    });

    // 8. 产品名称 (更精确的提取)
    let productName = '';

    // 优先从 og:site_name 获取
    const ogSiteName = getAttr('meta[property="og:site_name"]', 'content');
    if (ogSiteName) {
      productName = ogSiteName;
    } else if (seo.ogTitle) {
      // 从 og:title 提取第一部分
      const parts = seo.ogTitle.split(/[·|\-|–|\\|\/]/);
      productName = parts[parts.length > 1 ? 1 : 0].trim();
    } else if (seo.title) {
      // 从 title 提取
      const parts = seo.title.split(/[·|\-|–|\\|\/]/);
      productName = parts[parts.length > 1 ? 1 : 0].trim();
    } else if (headings.h1[0] && headings.h1[0].length < 50) {
      productName = headings.h1[0];
    }

    // 清理产品名称
    productName = productName.replace(/^(Welcome to|Home\s*-?\s*)/i, '').trim();
    // 清理特殊字符
    productName = productName.replace(/[\\\/\|\-]/g, '').trim();

    // 9. 导航菜单 (了解网站结构)
    const navItems = getText('nav a, header a, [class*="nav"] a').slice(0, 15);

    // 10. Footer 信息
    const footerText = document.querySelector('footer')?.innerText?.split('\n').slice(0, 10) || [];

    // 11. 表单标签 (了解产品功能)
    const formLabels = getText('label, [class*="form-label"]').slice(0, 15);

    // 12. 图片 alt 文字
    const imageAlts = Array.from(document.querySelectorAll('img[alt]'))
      .map(img => img.alt)
      .filter(alt => alt.length > 5 && alt.length < 100)
      .slice(0, 20);

    // 13. 数据属性 (有些网站把描述放在 data-* 里)
    const dataDescriptions = [];
    document.querySelectorAll('[data-description], [data-title], [data-tooltip]').forEach(el => {
      const desc = el.dataset.description || el.dataset.title || el.dataset.tooltip;
      if (desc) dataDescriptions.push(desc);
    });

    // 14. 提取网站配色方案
    const colorPalette = extractColorPalette();

    return {
      url: window.location.href,
      seo,
      jsonLd,
      headings,
      paragraphs,
      listItems,
      ctaTexts,
      features: [...new Set(features)].slice(0, 20),
      productName,
      navItems,
      footerText,
      formLabels,
      imageAlts,
      dataDescriptions,
      colorPalette,
    };
  });
}

/**
 * 整合内容为 AI 友好的格式
 */
function formatContentForAI(content) {
  const parts = [];

  // SEO 核心
  if (content.seo.title) parts.push(`【页面标题】${content.seo.title}`);
  if (content.seo.description) parts.push(`【页面描述】${content.seo.description}`);
  if (content.seo.keywords) parts.push(`【关键词】${content.seo.keywords}`);

  // 产品名
  if (content.productName) parts.push(`【产品名称】${content.productName}`);

  // 主标题
  if (content.headings.h1.length > 0) {
    parts.push(`【主标题】${content.headings.h1.join(' | ')}`);
  }

  // 副标题
  if (content.headings.h2.length > 0) {
    parts.push(`【副标题】${content.headings.h2.slice(0, 5).join(' | ')}`);
  }

  // 功能特性
  if (content.features.length > 0) {
    parts.push(`【功能特性】${content.features.slice(0, 10).join('\n  - ')}`);
  }

  // 列表项 (通常是功能点)
  if (content.listItems.length > 0) {
    const items = content.listItems.filter(t => t.length > 5 && t.length < 100).slice(0, 15);
    if (items.length > 0) {
      parts.push(`【要点列表】${items.join('\n  - ')}`);
    }
  }

  // 段落文字
  if (content.paragraphs.length > 0) {
    const paras = content.paragraphs.filter(p => p.length > 20).slice(0, 5);
    if (paras.length > 0) {
      parts.push(`【正文段落】${paras.join('\n\n')}`);
    }
  }

  // CTA 按钮
  if (content.ctaTexts.length > 0) {
    parts.push(`【行动号召】${content.ctaTexts.join(' | ')}`);
  }

  // 导航结构
  if (content.navItems.length > 0) {
    parts.push(`【导航菜单】${content.navItems.slice(0, 10).join(' | ')}`);
  }

  // JSON-LD 结构化数据
  if (content.jsonLd.length > 0) {
    const ld = content.jsonLd[0];
    if (ld.name) parts.push(`【结构化名称】${ld.name}`);
    if (ld.description) parts.push(`【结构化描述】${ld.description}`);
    if (ld.offers?.price) parts.push(`【价格】${ld.offers.price}`);
  }

  return parts.join('\n\n');
}

/**
 * 注入探针：遍历 DOM，为大容器打上 data-ai-id 编号，提取文字摘要
 * 返回所有候选区块的信息
 */
async function injectProbesAndExtractBlocks(page) {
  return await page.evaluate(() => {
    // 辅助函数：检查两个元素是否有嵌套/重叠关系
    // 使用绝对位置（考虑滚动）
    const checkOverlap = (rect1, rect2) => {
      // 只有当两个元素的位置和尺寸都非常接近时才认为重叠
      const positionThreshold = 100; // 位置差距阈值（像素）
      const sizeThreshold = 0.9; // 尺寸相似度阈值

      // 检查位置是否非常接近
      const samePosition =
        Math.abs(rect1.top - rect2.top) < positionThreshold &&
        Math.abs(rect1.left - rect2.left) < positionThreshold;

      // 检查尺寸是否非常相似
      const sameSize =
        Math.abs(rect1.width - rect2.width) / Math.max(rect1.width, rect2.width) < (1 - sizeThreshold) &&
        Math.abs(rect1.height - rect2.height) / Math.max(rect1.height, rect2.height) < (1 - sizeThreshold);

      // 只有两个元素位置和尺寸都非常接近时才认为重叠
      return samePosition && sameSize;
    };

    const candidates = [];
    const containerData = []; // 先收集所有容器数据

    // 只关注这些容器元素（排除 header/footer/nav）
    const containerSelectors = ['section', 'article', 'main'];
    // 以及带语义化 class/id 的 div
    const semanticPatterns = ['section', 'block', 'module', 'container', 'wrapper', 'area',
      'hero', 'feature', 'pricing', 'testimonial', 'about', 'team', 'contact', 'faq', 'cta'];

    // 获取滚动偏移
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // 收集所有候选容器
    const containers = new Set();

    // 【优先策略】1. 查找所有 main 元素，收集其中的所有 section
    // 注意：一个页面可能有多个 main 元素（虽然不符合规范，但实际上存在）
    const mainElements = document.querySelectorAll('main');
    mainElements.forEach(mainElement => {
      // 收集 main 内所有的 section 标签
      const mainSections = mainElement.querySelectorAll('section');
      mainSections.forEach(el => {
        containers.add(el);
      });
    });

    // 2. 收集语义化标签（排除 main 本身）
    containerSelectors.forEach(tag => {
      document.querySelectorAll(tag).forEach(el => {
        // 如果是 main 元素本身，跳过（我们只想要它里面的内容）
        if (el.tagName.toLowerCase() === 'main') return;
        containers.add(el);
      });
    });

    // 3. 收集带语义化 class/id 的 div（排除 main 的直接子 div，因为它们通常是包裹容器）
    document.querySelectorAll('div[class], div[id]').forEach(el => {
      // 如果是任意 main 的直接子 div，跳过（它们通常是包裹多个 section 的容器）
      const isMainChild = Array.from(mainElements).some(main => el.parentElement === main);
      if (isMainChild) return;

      const className = (el.className || '').toString().toLowerCase();
      const id = (el.id || '').toLowerCase();
      const combined = `${className} ${id}`;

      if (semanticPatterns.some(p => combined.includes(p))) {
        containers.add(el);
      }
    });

    // 4. 过滤掉"包裹容器"：如果一个 div 包含其他已收集的 section，则排除该 div
    // 这些通常是布局容器，不是真正的内容区块
    const sectionElements = new Set();
    containers.forEach(el => {
      if (el.tagName.toLowerCase() === 'section') {
        sectionElements.add(el);
      }
    });

    // 检查每个 div 是否包含 section
    const containersToRemove = new Set();
    containers.forEach(el => {
      if (el.tagName.toLowerCase() === 'div') {
        // 检查这个 div 是否包含其他 section
        let containsSection = false;
        sectionElements.forEach(section => {
          if (el.contains(section) && el !== section) {
            containsSection = true;
          }
        });
        if (containsSection) {
          containersToRemove.add(el);
        }
      }
    });

    containersToRemove.forEach(el => containers.delete(el));

    // 5. 遍历并收集数据（先不打标签）
    containers.forEach(el => {
      const rect = el.getBoundingClientRect();

      // 检查是否是 section 标签（优先级更高）
      const isSection = el.tagName.toLowerCase() === 'section';

      // 过滤掉太小的元素（section 放宽限制）
      const minWidth = isSection ? 200 : 300;
      const minHeight = isSection ? 100 : 150;
      if (rect.width < minWidth || rect.height < minHeight) return;

      // 过滤掉太大的元素
      // section 不限制高度，可能是长内容区块
      // 其他元素（如 div 容器）限制为视口高度的 2 倍
      if (!isSection && rect.height > window.innerHeight * 2.0) return;

      // 过滤掉太宽的元素（可能是横向滚动的轮播图）
      if (rect.width > window.innerWidth * 1.1) return;

      // 过滤掉不可见元素
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;

      // 过滤掉 footer/header/nav 标签内的所有元素（通常是导航和页脚）
      if (el.closest('footer, header, nav')) return;

      // 过滤掉 footer 区域（通常是低价值内容）
      const className = (el.className || '').toString().toLowerCase();
      const id = (el.id || '').toLowerCase();
      if (className.includes('footer') || id.includes('footer')) return;

      // 计算绝对位置（加上滚动偏移）
      const absoluteRect = {
        left: rect.left + scrollX,
        right: rect.right + scrollX,
        top: rect.top + scrollY,
        bottom: rect.bottom + scrollY,
        width: rect.width,
        height: rect.height
      };

      // 提取文字摘要
      const innerText = (el.innerText || '').trim();
      const textSummary = innerText.substring(0, 200).replace(/\n+/g, ' ').trim();

      // 过滤掉内容太少的区块（空白检测）
      const area = rect.width * rect.height;
      const textLength = innerText.length;
      const contentDensity = textLength / area;

      // 如果文字密度太低（< 0.001 字符/像素），可能是空白区域
      if (textLength < 50 && contentDensity < 0.0005) return;

      // 过滤掉只有链接的区域（通常是 footer 或导航）
      const links = el.querySelectorAll('a');
      const linkCount = links.length;
      const linkTextLength = Array.from(links).reduce((sum, a) => sum + (a.innerText?.length || 0), 0);

      // 如果大部分内容都是链接文字，跳过
      if (textLength > 0 && linkTextLength / textLength > 0.8 && textLength < 200) return;

      // 提取标题
      const h1 = el.querySelector('h1');
      const h2 = el.querySelector('h2');
      const heading = (h1 || h2)?.innerText?.trim() || '';

      // 提取 CTA 按钮
      const ctaBtn = el.querySelector('button, a[class*="btn"], a[class*="button"]');
      const ctaText = ctaBtn?.innerText?.trim() || '';

      // 判断区块类型（className、id、heading、textSummary 都参与判断）
      const combined = `${className} ${id} ${heading} ${textSummary}`.toLowerCase();

      let suggestedType = 'content';
      if (combined.includes('hero') || combined.includes('banner')) suggestedType = 'hero';
      else if (combined.includes('pricing') || combined.includes('plan')) suggestedType = 'pricing';
      else if (combined.includes('testimonial') || combined.includes('review')) suggestedType = 'testimonials';
      else if (combined.includes('feature') || combined.includes('benefit')) suggestedType = 'features';
      else if (combined.includes('faq') || combined.includes('question') || combined.includes('frequently asked')) suggestedType = 'faq';
      else if (combined.includes('about') || combined.includes('team')) suggestedType = 'about';
      else if (combined.includes('cta') || combined.includes('contact') || combined.includes('get started') || combined.includes('sign up')) suggestedType = 'cta';

      containerData.push({
        element: el,
        rect: absoluteRect,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: absoluteRect.top,
        aspectRatio: (rect.width / rect.height).toFixed(2),
        heading: heading.substring(0, 80),
        textSummary: textSummary.substring(0, 150),
        ctaText,
        suggestedType,
        className: className.substring(0, 100),
        isSection,
        // section 加分，确保优先被选中
        contentScore: innerText.length + (heading ? 100 : 0) + (ctaText ? 50 : 0) + (isSection ? 500 : 0)
      });
    });

    // 4. 去重：排除位置和尺寸都非常接近的元素
    // 按内容丰富度排序
    containerData.sort((a, b) => b.contentScore - a.contentScore);

    const filteredContainers = [];

    for (const data of containerData) {
      // 检查是否与已选容器重复
      let isDuplicate = false;
      for (const existing of filteredContainers) {
        if (checkOverlap(data.rect, existing.rect)) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        filteredContainers.push(data);
      }

      if (filteredContainers.length >= 15) break;
    }

    // 5. 打标签并返回
    let probeId = 0;
    filteredContainers.forEach(data => {
      probeId++;
      data.element.setAttribute('data-ai-id', probeId);

      candidates.push({
        id: probeId,
        selector: `[data-ai-id="${probeId}"]`,
        width: data.width,
        height: data.height,
        top: data.top,
        aspectRatio: data.aspectRatio,
        heading: data.heading,
        textSummary: data.textSummary,
        ctaText: data.ctaText,
        suggestedType: data.suggestedType,
        className: data.className,
        contentScore: data.contentScore
      });
    });

    // 【通用宽度标记】为每个候选区块标记宽度等级
    const viewportWidth = window.innerWidth;
    candidates.forEach(c => {
      const widthRatio = c.width / viewportWidth;
      if (widthRatio >= 0.9) {
        c.widthLevel = 'full';
      } else if (widthRatio >= 0.7) {
        c.widthLevel = 'wide';
      } else if (widthRatio >= 0.5) {
        c.widthLevel = 'medium';
      } else {
        c.widthLevel = 'narrow';
      }
    });

    return candidates;
  });
}

/**
 * AI 智能挑选区块：让 AI 从候选区块中选出最适合做视频的区块
 * AI 会根据页面内容智能决定截图数量（3-8张）
 */
/**
 * 后处理：优先选择宽度最接近全屏的区块
 * 如果选中了多个宽度相近的窄区块，尝试找全屏区块替换
 */
async function postProcessSelectedBlocks(selectedBlocks, allCandidates) {
  // 先从 allCandidates 里把 widthLevel 补回到 selectedBlocks
  selectedBlocks.forEach(b => {
    const original = allCandidates.find(c => c.id === b.id);
    if (original && original.widthLevel) {
      b.widthLevel = original.widthLevel;
      b.top = original.top;
    }
  });

  // 找出选中的窄区块（宽度 < 50% viewport）
  const narrowBlocks = selectedBlocks.filter(b => b.widthLevel === 'narrow');
  const fullWidthBlocks = selectedBlocks.filter(b => b.widthLevel === 'full');

  // 如果有 2 个以上窄区块，且没有全屏区块，尝试找全屏区块替换
  if (narrowBlocks.length >= 2 && fullWidthBlocks.length === 0) {
    const minTop = Math.min(...narrowBlocks.map(b => b.top || 0));
    const maxTop = Math.max(...narrowBlocks.map(b => b.top || 0));

    // 从所有候选区块中找全屏区块（在窄区块的位置范围附近）
    const fullScreenCandidate = allCandidates.find(b =>
      b.widthLevel === 'full' &&
      (b.top || 0) >= minTop - 300 &&
      (b.top || 0) <= maxTop + 300 &&
      !selectedBlocks.find(s => s.id === b.id)
    );

    if (fullScreenCandidate) {
      console.log(`   🔄 检测到 ${narrowBlocks.length} 个窄区块，找到全屏区块替换`);
      const result = selectedBlocks.filter(b => !narrowBlocks.includes(b));
      result.push(fullScreenCandidate);
      return result;
    }
  }

  return selectedBlocks;
}

async function aiSelectBlocks(candidates, pageContent) {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('   ⚠️  未配置 API Key，使用默认选择策略');
    // 默认策略：按类型优先级选择，智能决定数量
    const typePriority = ['hero', 'features', 'pricing', 'testimonials', 'about', 'cta', 'content'];
    const selected = [];
    for (const type of typePriority) {
      const found = candidates.find(c => c.suggestedType === type && !selected.includes(c));
      if (found) selected.push(found);
    }

    // 内容语义去重
    const deduped = [];
    for (const block of selected) {
      const blockText = (block.textSummary || block.text || '').toLowerCase();
      let isDuplicate = false;

      for (const existing of deduped) {
        const existingText = (existing.textSummary || existing.text || '').toLowerCase();
        const similarity = calculateTextSimilarity(blockText, existingText);
        if (similarity > 0.7) {
          console.log(`   ⚠️  区块 #${block.id} 与 #${existing.id} 内容相似度 ${Math.round(similarity * 100)}%，已跳过`);
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        deduped.push(block);
      }
    }

    // 不再强制补齐，返回有意义的内容即可
    console.log(`   📊 默认策略选择了 ${deduped.length} 个区块`);
    return deduped;
  }

  const prompt = `You are a professional video designer. Analyze the website and decide how many sections to capture for a marketing video.

Website: ${pageContent.productName || pageContent.seo?.title || 'Unknown'}
Description: ${pageContent.seo?.description || 'N/A'}

Available sections (with data-ai-id):

${candidates.map(c => `[${c.id}] ${c.suggestedType.toUpperCase()}
  Heading: ${c.heading || 'N/A'}
  Text: ${c.textSummary || 'N/A'}
  CTA: ${c.ctaText || 'N/A'}
  Size: ${c.width}x${c.height} (${c.aspectRatio})`).join('\n\n')}

TASK: Select ALL meaningful sections for a promotional video.

SELECTION RULES:
1. Include ALL sections that have unique, meaningful content
2. Include: Hero, Features, Benefits, How-it-works, Use cases, Pricing, Testimonials, FAQ, Awards/Recognition
3. Include sections with logos, brand mentions, or social proof
4. ONLY skip sections that are:
   - Empty or have placeholder content
   - Exact duplicates of other sections (same text)
   - Very small fragments (< 300px height)
5. When in doubt, INCLUDE the section rather than skip it

Output JSON array only (list ALL section IDs that should be captured):
[id1, id2, id3, ...]`;

  try {
    const result = await callAI(prompt, { maxTokens: 1000, temperature: 0.3 });

    if (!result) {
      console.log('   ⚠️  AI 返回 null，使用所有候选区块');
      return candidates;
    }

    // 兼容两种格式：数组直接返回 或 { selectedIds: [...] } 对象
    let selectedIds;
    if (Array.isArray(result)) {
      selectedIds = result;
    } else {
      selectedIds = result.selectedIds || [];
    }

    // 按 AI 选择的顺序排列
    const selected = selectedIds
      .map(id => candidates.find(c => c.id === id))
      .filter(Boolean);

    // 保存原因
    selected.forEach(c => {
      c.reason = result.reasons?.[c.id] || '';
    });

    // 去重：同类型区块限制（Hero 最多 1 个，content 类型不限制）
    const seenTypes = new Set();
    const deduped = [];
    for (const block of selected) {
      const type = block.suggestedType;
      // Hero 类型只允许 1 个
      if (type === 'hero' && seenTypes.has('hero')) continue;
      // content 类型不限制数量（因为很多区块都是 content）
      if (type !== 'content') {
        // 其他类型最多 2 个
        const count = [...seenTypes].filter(t => t === type).length;
        if (count >= 2) continue;
      }
      seenTypes.add(type);
      deduped.push(block);
    }

    // 内容语义去重：排除内容高度相似的区块
    const contentDeduped = [];
    for (const block of deduped) {
      const blockText = (block.textSummary || block.text || '').toLowerCase();
      let isDuplicate = false;

      for (const existing of contentDeduped) {
        const existingText = (existing.textSummary || existing.text || '').toLowerCase();
        // 计算文本相似度（词组重合度）
        const similarity = calculateTextSimilarity(blockText, existingText);
        if (similarity > 0.7) {
          console.log(`   ⚠️  区块 #${block.id} 与 #${existing.id} 内容相似度 ${Math.round(similarity * 100)}%，已跳过`);
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        contentDeduped.push(block);
      }
    }

    // 空间包含去重：如果一个区块完全在另一个区块内部，排除较小的区块
    const spatialDeduped = [];
    for (const block of contentDeduped) {
      let isContained = false;
      for (const existing of spatialDeduped) {
        // 检查 block 是否在 existing 内部
        if (block.top !== undefined && existing.top !== undefined &&
            block.height !== undefined && existing.height !== undefined) {
          const blockBottom = block.top + block.height;
          const existingBottom = existing.top + existing.height;
          // 如果 block 的范围完全在 existing 的范围内
          if (block.top >= existing.top && blockBottom <= existingBottom) {
            isContained = true;
            console.log(`   ⚠️  区块 #${block.id} 在区块 #${existing.id} 内部，已跳过`);
            break;
          }
        }
      }
      if (!isContained) {
        spatialDeduped.push(block);
      }
    }

    // 不再强制补齐，AI 已决定最佳数量
    console.log(`   🤖 AI 选择了 ${spatialDeduped.length} 个区块`);
    return spatialDeduped;
  } catch (e) {
    return candidates;
  }
}

/**
 * 识别网站的功能区块（保留用于备用）
 * 分析 HTML 结构，识别独立的功能模块（如 hero、features、pricing 等）
 */
async function identifyFunctionalSections(page) {
  return await page.evaluate(() => {
    const sections = [];

    // 常见的功能区块选择器和类型映射
    // 注意：patterns 用于匹配 class/id，关键词越具体越靠前
    const sectionPatterns = [
      // 定价 - 放在前面避免被 features 匹配
      { patterns: ['pricing', 'plan', 'package', 'subscription', 'price-card'], type: 'pricing', priority: 3 },
      // 客户评价 - 具体关键词
      { patterns: ['testimonial', 'review', 'customer-story', 'case-study', 'feedback'], type: 'testimonials', priority: 3 },
      // 如何工作
      { patterns: ['how-it-works', 'how-to', 'workflow', 'process-step'], type: 'how-it-works', priority: 2 },
      // 功能特性 - 通用关键词
      { patterns: ['feature', 'benefit', 'capability', 'advantage', 'why-choose', 'highlight'], type: 'features', priority: 2 },
      // 产品展示
      { patterns: ['product-showcase', 'demo', 'gallery', 'portfolio'], type: 'product', priority: 2 },
      // 团队
      { patterns: ['team', 'about-us', 'who-we-are', 'our-team'], type: 'team', priority: 4 },
      // 合作伙伴
      { patterns: ['partner', 'client-logo', 'trusted-by', 'customers'], type: 'partners', priority: 4 },
      // 常见问题
      { patterns: ['faq', 'question', 'help-center', 'support'], type: 'faq', priority: 4 },
      // 博客/资源
      { patterns: ['blog', 'article', 'resource', 'news', 'insight'], type: 'blog', priority: 4 },
      // 行动号召 - 通常在页面底部
      { patterns: ['cta', 'call-to-action', 'get-started', 'signup-form', 'contact-us'], type: 'cta', priority: 5 },
      // Hero - 最后匹配，因为很多区块可能带有 hero 相关的词
      { patterns: ['hero-section', 'hero-banner', 'hero-content', 'jumbotron'], type: 'hero', priority: 1 },
    ];

    // 收集所有候选区块
    const candidates = [];

    // 1. 分析 <section> 元素（最常见的区块容器）
    document.querySelectorAll('section').forEach((el, idx) => {
      const className = (el.className || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      const innerText = (el.innerText || '');
      const text = innerText.substring(0, 300).toLowerCase();
      const combined = `${className} ${id}`;

      // 匹配区块类型
      let matchedType = 'content';
      let matchedPriority = 3;
      let matchScore = 0;

      for (const pattern of sectionPatterns) {
        for (const keyword of pattern.patterns) {
          if (combined.includes(keyword)) {
            // class/id 匹配得分更高
            const score = 10;
            if (score > matchScore) {
              matchedType = pattern.type;
              matchedPriority = pattern.priority;
              matchScore = score;
            }
            break;
          }
        }
      }

      // 如果没有通过 class/id 匹配，尝试通过内容特征判断
      if (matchedType === 'content') {
        // 检测定价特征
        if (text.includes('$') && (text.includes('month') || text.includes('year') || text.includes('plan'))) {
          matchedType = 'pricing';
          matchedPriority = 3;
        }
        // 检测评价特征
        else if (text.includes('testimonial') || text.includes('review') ||
                 (innerText.includes('"') && innerText.length < 500 && innerText.includes('CEO'))) {
          matchedType = 'testimonials';
          matchedPriority = 3;
        }
        // 检测功能特性特征
        else if ((text.includes('feature') || text.includes('benefit')) && innerText.length > 200) {
          matchedType = 'features';
          matchedPriority = 2;
        }
        // 检测 CTA 特征
        else if ((text.includes('get started') || text.includes('sign up') || text.includes('try free')) &&
                 innerText.length < 300) {
          matchedType = 'cta';
          matchedPriority = 5;
        }
      }

      const rect = el.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      // 只记录有意义的区块
      if (rect.height > 150 && rect.width > 300) {
        candidates.push({
          element: el,
          type: matchedType,
          priority: matchedPriority,
          top: rect.top + scrollTop,
          height: rect.height,
          width: rect.width,
          className: className,
          id: id,
          text: innerText.substring(0, 150).replace(/\n/g, ' ').trim(),
          textLength: innerText.length
        });
      }
    });

    // 2. 分析带语义化 class 的 <div> 元素
    document.querySelectorAll('div[class], div[id]').forEach((el) => {
      const className = (el.className || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      const combined = `${className} ${id}`;

      // 只检查明显的语义化容器
      const semanticKeywords = ['section', 'block', 'module', 'area', 'zone', 'wrapper'];
      const isSemanticContainer = semanticKeywords.some(k => combined.includes(k));

      // 检查是否有功能区块的 class/id
      const hasFunctionClass = sectionPatterns.some(p => p.patterns.some(k => combined.includes(k)));

      if (isSemanticContainer || hasFunctionClass) {
        // 匹配区块类型
        let matchedType = 'content';
        let matchedPriority = 3;

        for (const pattern of sectionPatterns) {
          for (const keyword of pattern.patterns) {
            if (combined.includes(keyword)) {
              matchedType = pattern.type;
              matchedPriority = pattern.priority;
              break;
            }
          }
          if (matchedType !== 'content') break;
        }

        const rect = el.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // 只记录有意义的区块
        if (rect.height > 150 && rect.width > 300) {
          // 检查是否与已有候选重叠
          const overlapsExisting = candidates.some(c =>
            Math.abs(c.top - (rect.top + scrollTop)) < 200 && Math.abs(c.height - rect.height) < 200
          );

          if (!overlapsExisting) {
            const innerText = (el.innerText || '');
            candidates.push({
              element: el,
              type: matchedType,
              priority: matchedPriority,
              top: rect.top + scrollTop,
              height: rect.height,
              width: rect.width,
              className: className,
              id: id,
              text: innerText.substring(0, 150).replace(/\n/g, ' ').trim(),
              textLength: innerText.length
            });
          }
        }
      }
    });

    // 3. 如果识别到的区块太少，通过标题元素补充
    if (candidates.length < 3) {
      document.querySelectorAll('h2, h3').forEach((h) => {
        const rect = h.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const absoluteTop = rect.top + scrollTop;

        // 只处理首屏以下
        if (absoluteTop > 400) {
          // 找到包含这个标题的最近容器
          const container = h.closest('section, div[class*="section"], div[class*="block"], div[class*="container"], article, main');
          if (container) {
            const containerRect = container.getBoundingClientRect();
            const containerTop = containerRect.top + scrollTop;

            // 检查是否已存在
            const exists = candidates.some(c => Math.abs(c.top - containerTop) < 200);
            if (!exists && containerRect.height > 150 && containerRect.height < 1800) {
              const innerText = (container.innerText || '');
              candidates.push({
                element: container,
                type: 'content',
                priority: 3,
                top: containerTop,
                height: containerRect.height,
                width: containerRect.width,
                className: (container.className || '').toLowerCase(),
                id: (container.id || '').toLowerCase(),
                text: h.innerText || '',
                textLength: innerText.length
              });
            }
          }
        }
      });
    }

    // 按位置排序
    candidates.sort((a, b) => a.top - b.top);

    // 去重 - 如果同一位置有多个区块，保留内容更丰富的
    const dedupedCandidates = [];
    const positionGroups = new Map();

    for (const candidate of candidates) {
      const posKey = Math.round(candidate.top / 300) * 300; // 按 300px 分组
      if (!positionGroups.has(posKey)) {
        positionGroups.set(posKey, []);
      }
      positionGroups.get(posKey).push(candidate);
    }

    for (const [, group] of positionGroups) {
      // 每个位置只保留一个区块，优先选择内容更丰富的
      group.sort((a, b) => b.textLength - a.textLength);
      dedupedCandidates.push(group[0]);
    }

    // 再次按位置排序
    dedupedCandidates.sort((a, b) => a.top - b.top);



    // 类型去重 - 同一类型的区块最多保留 2 个
    const typeCount = {};
    const finalSections = [];

    for (const candidate of dedupedCandidates) {
      if (!typeCount[candidate.type]) {
        typeCount[candidate.type] = 0;
      }
      if (typeCount[candidate.type] < 2) {
        finalSections.push(candidate);
        typeCount[candidate.type]++;
      }
    }

    // 确保有首屏
    if (finalSections.length === 0 || finalSections[0].top > 100) {
      finalSections.unshift({
        type: 'hero',
        priority: 1,
        top: 0,
        height: 900,
        text: '首屏 Hero 区域',
        className: '',
        id: '',
        textLength: 0
      });
    }

    // 标记每个区块的主题
    return finalSections.slice(0, 6).map((section, index) => {
      // 根据区块类型生成描述
      const typeDescriptions = {
        'hero': 'Hero 首屏',
        'features': '功能特性',
        'product': '产品展示',
        'pricing': '定价方案',
        'testimonials': '用户评价',
        'how-it-works': '使用流程',
        'team': '团队介绍',
        'partners': '合作伙伴',
        'faq': '常见问题',
        'cta': '行动号召',
        'blog': '博客文章',
        'content': '内容区块'
      };

      return {
        ...section,
        index: index + 1,
        description: typeDescriptions[section.type] || '内容区块',
        typeLabel: section.type
      };
    });
  });
}

/**
 * 检测图片内容密度，判断是否为空白图片
 * 返回 { isValid: boolean, contentRatio: number, reason: string }
 */
async function checkScreenshotContentDensity(imagePath) {
  // 使用简单的文件分析来判断内容密度
  // 空白图片通常压缩后很小，且像素变化少

  const stats = fs.statSync(imagePath);
  const fileSize = stats.size;

  // 读取图片尺寸
  const { execSync } = require('child_process');
  try {
    // 使用 node 的方式检测图片信息
    const imageBuffer = fs.readFileSync(imagePath);

    // PNG 文件头检测
    // 空白图片特征：文件小、宽高比异常、像素方差小

    // 简单的启发式规则：
    // 1. 文件大小与图片尺寸比例（1440x900 的有意义截图通常 > 100KB）
    // 2. 如果文件太小，可能是空白

    // 获取图片尺寸（从 PNG 头解析）
    let width = 0, height = 0;
    if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) { // PNG magic
      width = imageBuffer.readUInt32BE(16);
      height = imageBuffer.readUInt32BE(20);
    }

    const pixelCount = width * height;
    const bytesPerPixel = fileSize / pixelCount;

    // 有意义的截图通常每像素 > 0.02 字节（压缩后）
    // 空白/单色图片通常 < 0.01 字节/像素
    // 阈值设置：0.02 可以过滤掉真正的空白图，但不会误判简洁设计
    const contentRatio = bytesPerPixel;

    if (pixelCount > 0 && bytesPerPixel < 0.02) {
      return {
        isValid: false,
        contentRatio,
        reason: `内容密度过低 (${bytesPerPixel.toFixed(3)} bytes/pixel)，可能是空白图片`
      };
    }

    // 检查文件大小是否合理
    // 1440x900 的有效截图通常 > 100KB，但有些简洁设计可能更小
    if (fileSize < 30000) { // < 30KB
      return {
        isValid: false,
        contentRatio,
        reason: `文件过小 (${Math.round(fileSize / 1024)}KB)，内容可能不足`
      };
    }

    return {
      isValid: true,
      contentRatio,
      reason: '内容密度正常'
    };
  } catch (e) {
    // 无法检测，默认通过
    return { isValid: true, contentRatio: 0, reason: '无法检测' };
  }
}

/**
 * 检测并关闭 Cookie/隐私弹窗
 */
async function dismissCookiePopup(page) {
  const popupSelectors = [
    // 常见的 Cookie 弹窗选择器
    'button[id*="accept"]', 'button[id*="agree"]', 'button[id*="consent"]',
    'button[class*="accept"]', 'button[class*="agree"]', 'button[class*="consent"]',
    'a[class*="accept"]', 'a[id*="accept"]',
    '[data-testid*="accept"]', '[data-testid*="agree"]',
    // 常见弹窗平台的按钮
    '#onetrust-accept-btn-handler', '.onetrust-accept-btn',
    '#accept-cookies', '.accept-cookies', '#cookie-accept',
    'button.cc-accept', 'button.cc-dismiss', 'a.cc-dismiss',
    '[aria-label*="Accept"]', '[aria-label*="accept"]',
    '[aria-label*="Agree"]', '[aria-label*="agree"]',
    // GDPR 弹窗
    'button[id*="gdpr"]', 'button[class*="gdpr"]',
    '.qc-cmp2-summary-buttons button', '.qc-cmp-button',
    // 通用关闭按钮
    'button[class*="close"]', 'button[aria-label*="close"]',
    '[class*="modal-close"]', '[class*="popup-close"]',
    // Figma 特定
    '[data-testid="cookie-banner-accept"]',
  ];

  const textPatterns = [
    'accept', 'agree', 'accept all', 'accept all cookies',
    'got it', 'okay', 'ok', 'continue', 'allow', 'allow all',
    'i agree', '同意', '接受', '允许', '确定'
  ];

  // 尝试通过选择器点击
  for (const selector of popupSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible().catch(() => false);
        if (isVisible) {
          await element.click({ timeout: 2000 }).catch(() => {});
          console.log('   🍪 已关闭 Cookie 弹窗 (选择器)');
          await page.waitForTimeout(500);
          return true;
        }
      }
    } catch (e) {}
  }

  // 尝试通过文本匹配点击
  for (const pattern of textPatterns) {
    try {
      const elements = await page.$$('button, a, [role="button"]');
      for (const el of elements) {
        const text = await el.textContent().catch(() => '');
        if (text.toLowerCase().includes(pattern)) {
          const isVisible = await el.isVisible().catch(() => false);
          if (isVisible) {
            await el.click({ timeout: 2000 }).catch(() => {});
            console.log(`   🍪 已关闭 Cookie 弹窗 (文本: "${pattern}")`);
            await page.waitForTimeout(500);
            return true;
          }
        }
      }
    } catch (e) {}
  }

  return false;
}

/**
 * 检测并关闭登录/注册弹窗和其他模态框
 */
async function dismissModalDialogs(page) {
  let dismissed = false;

  // 1. 尝试按 Escape 键关闭弹窗
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 检查是否还有可见的模态框
    const hasModal = await page.evaluate(() => {
      const modals = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="popup"], [class*="overlay"]');
      for (const modal of modals) {
        const style = getComputedStyle(modal);
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          return true;
        }
      }
      return false;
    });

    if (!hasModal) {
      console.log('   ✖️ 已按 Escape 关闭弹窗');
      dismissed = true;
    }
  } catch (e) {}

  // 2. 尝试点击关闭按钮
  const closeSelectors = [
    // 通用关闭按钮
    'button[aria-label*="close"]', 'button[aria-label*="Close"]',
    '[aria-label*="关闭"]', '[aria-label*="close-dialog"]',
    'button[class*="close"]', '[class*="close-button"]',
    '[class*="modal-close"]', '[class*="dialog-close"]',
    // X 图标按钮
    'button[data-testid*="close"]', '[data-testid*="close-btn"]',
    // Figma 特定
    '[data-testid="CloseButton"]', 'button[class*="CloseButton"]',
    // SVG close icons
    'button svg[class*="close"]', 'button:has(svg[class*="close"])',
    // 其他常见关闭按钮
    '.modal__close', '.dialog__close', '.popup__close',
    '[class*="Dismiss"]', '[class*="dismiss"]',
  ];

  for (const selector of closeSelectors) {
    try {
      const elements = await page.$$(selector);
      for (const el of elements) {
        const isVisible = await el.isVisible().catch(() => false);
        if (isVisible) {
          await el.click({ timeout: 2000 }).catch(() => {});
          console.log(`   ✖️ 已点击关闭按钮 (${selector})`);
          await page.waitForTimeout(500);
          dismissed = true;
          break;
        }
      }
      if (dismissed) break;
    } catch (e) {}
  }

  // 3. 尝试点击模态框外部区域关闭
  if (!dismissed) {
    try {
      // 点击页面顶部边缘（通常是安全的区域）
      await page.mouse.click(100, 10);
      await page.waitForTimeout(300);

      // 检查模态框是否消失
      const stillHasModal = await page.evaluate(() => {
        const modals = document.querySelectorAll('[role="dialog"], [class*="modal"]');
        for (const modal of modals) {
          const style = getComputedStyle(modal);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            return true;
          }
        }
        return false;
      });

      if (!stillHasModal) {
        console.log('   ✖️ 已点击外部区域关闭弹窗');
        dismissed = true;
      }
    } catch (e) {}
  }

  // 4. 尝试查找并点击 "Not now", "Skip", "No thanks" 等按钮
  const skipTexts = ['not now', 'skip', 'no thanks', 'later', 'maybe later', 'remind me later', 'close', '取消', '稍后'];
  for (const text of skipTexts) {
    try {
      const elements = await page.$$('button, a, [role="button"], span[role="button"]');
      for (const el of elements) {
        const elText = await el.textContent().catch(() => '');
        if (elText.toLowerCase().includes(text)) {
          const isVisible = await el.isVisible().catch(() => false);
          if (isVisible) {
            await el.click({ timeout: 2000 }).catch(() => {});
            console.log(`   ✖️ 已点击 "${text}" 按钮关闭弹窗`);
            await page.waitForTimeout(500);
            dismissed = true;
            break;
          }
        }
      }
      if (dismissed) break;
    } catch (e) {}
  }

  return dismissed;
}

/**
 * 隐藏所有模态框和弹窗（通过 CSS）
 */
async function hideModalsWithCSS(page) {
  await page.addStyleTag({
    content: `
      /* 隐藏常见的模态框 */
      [role="dialog"],
      [class*="modal"]:not(body),
      [class*="Modal"]:not(body),
      [class*="popup"]:not(body),
      [class*="Popup"]:not(body),
      [class*="overlay"]:not(body),
      [class*="Overlay"]:not(body),
      [class*="dialog"]:not(body),
      [class*="Dialog"]:not(body),
      [class*="lightbox"],
      [class*="Lightbox"],
      /* 背景遮罩 */
      [class*="backdrop"],
      [class*="Backdrop"],
      /* 登录/注册弹窗 */
      [class*="login-modal"],
      [class*="signup-modal"],
      [class*="auth-modal"],
      /* Cookie 弹窗 - 通用选择器 */
      [data-testid="cookie-banner"],
      [data-testid="CookieBanner"],
      [data-testid*="cookie"],
      [data-testid*="Cookie"],
      [id*="cookie-banner"],
      [id*="CookieBanner"],
      [id*="cookieconsent"],
      [id*="cookie-consent"],
      [class*="CookieBanner"],
      [class*="cookie-banner"],
      [class*="cookie-consent"],
      [class*="cookieconsent"],
      [class*="cookie-notice"],
      [class*="CookieNotice"],
      [class*="cookie-popup"],
      [class*="cookie-modal"],
      [class*="cc-banner"],
      [class*="cc-banner"],
      .cc-window,
      .cc-banner,
      .cc-floating,
      #onetrust-banner-sdk,
      .onetrust-pc-dark-filter,
      #onetrust-consent-sdk,
      /* Figma 特定 - 更全面的选择器 */
      [class*="CookieConsent"],
      [class*="cookieConsent"],
      div[class*="cookie"][class*="banner"],
      div[class*="Cookie"][class*="Banner"],
      /* Newsletter 弹窗 */
      [class*="newsletter"],
      [class*="Newsletter"],
      /* Announcement 弹窗 */
      [class*="announcement"],
      [class*="Announcement"],
      /* 顶部公告栏 */
      [class*="announcement-bar"],
      [class*="AnnouncementBar"],
      [class*="top-banner"],
      [class*="TopBanner"],
      /* 聊天组件 */
      [class*="chat-widget"],
      [class*="livechat"],
      [class*="intercom"],
      [class*="Intercom"],
      {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        z-index: -9999 !important;
      }
      /* 移除 body 的滚动锁定 */
      body {
        overflow: auto !important;
        position: static !important;
      }
      /* 修复可能的 fixed 定位遮挡 */
      body > div[class*="cookie"],
      body > div[class*="Cookie"],
      body > div[id*="cookie"],
      body > div[id*="Cookie"] {
        display: none !important;
      }
    `
  });
}

/**
 * 用 AI 检查截图中是否有弹窗或遮挡物
 * 返回 { hasPopup: boolean, description: string, suggestedAction: string }
 */
async function checkForPopupsWithAI(page) {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { hasPopup: false, description: 'No API key', suggestedAction: 'none' };
  }

  const prompt = `Analyze this website screenshot and determine if there are any popups, modals, dialogs, cookie banners, or overlay elements blocking the main content.

Look for:
1. Cookie consent banners
2. Login/signup modals
3. Newsletter popups
4. Announcement banners
5. Any overlay that blocks the main content
6. Chat widgets that might be intrusive

Respond in JSON format only:
{
  "hasPopup": true/false,
  "popupType": "cookie/login/newsletter/announcement/other/none",
  "description": "Brief description of what you see blocking the content",
  "suggestedAction": "click_accept/click_close/press_escape/click_outside/none",
  "closeButtonText": "The text on the close button if visible, e.g. 'Accept', 'Close', 'X', 'Not now'"
}`;

  return new Promise((resolve) => {
    const apiUrl = process.env.API_BASE_URL || 'https://api.deepseek.com';

    // DeepSeek 不支持图片，所以用文字描述
    // 改用检测 DOM 元素的方式
    page.evaluate(() => {
      const potentialPopups = [];

      // 检查常见的弹窗元素
      const selectors = [
        '[role="dialog"]',
        '[class*="modal"]',
        '[class*="popup"]',
        '[class*="banner"]',
        '[class*="cookie"]',
        '[class*="overlay"]',
        '[data-testid*="modal"]',
        '[data-testid*="popup"]',
        '[data-testid*="banner"]'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();

          // 检查是否可见且在视口中
          if (style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              style.opacity !== '0' &&
              rect.width > 100 &&
              rect.height > 50) {

            // 获取按钮文字
            const buttons = el.querySelectorAll('button, a, [role="button"]');
            const buttonTexts = Array.from(buttons).map(b => b.textContent?.trim()).filter(t => t).slice(0, 3);

            potentialPopups.push({
              selector: selector,
              className: el.className?.substring(0, 50),
              text: el.textContent?.substring(0, 100).trim(),
              buttons: buttonTexts,
              position: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
            });
          }
        }
      }

      return potentialPopups;
    }).then(potentialPopups => {
      if (potentialPopups.length === 0) {
        resolve({ hasPopup: false, description: 'No popups detected', suggestedAction: 'none' });
        return;
      }

      // 找到最可能的弹窗（位置最靠上的）
      const mainPopup = potentialPopups.sort((a, b) => a.position.top - b.position.top)[0];

      let suggestedAction = 'press_escape';
      let closeButtonText = '';

      // 根据按钮文字建议操作
      for (const text of mainPopup.buttons) {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('accept') || lowerText.includes('agree') || lowerText.includes('ok')) {
          suggestedAction = 'click_accept';
          closeButtonText = text;
          break;
        } else if (lowerText.includes('close') || lowerText.includes('x')) {
          suggestedAction = 'click_close';
          closeButtonText = text;
          break;
        } else if (lowerText.includes('not now') || lowerText.includes('skip') || lowerText.includes('later')) {
          suggestedAction = 'click_close';
          closeButtonText = text;
          break;
        }
      }

      resolve({
        hasPopup: true,
        description: mainPopup.text || mainPopup.className,
        suggestedAction,
        closeButtonText,
        popupType: mainPopup.className?.includes('cookie') ? 'cookie' : 'modal'
      });
    }).catch(() => {
      resolve({ hasPopup: false, description: 'Check failed', suggestedAction: 'none' });
    });
  });
}

/**
 * 循环检查并关闭所有弹窗，直到页面干净
 */
async function ensureCleanPage(page, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`   🔍 检查弹窗 (尝试 ${attempt}/${maxAttempts})...`);

    // 先用 CSS 隐藏
    await hideModalsWithCSS(page);
    await page.waitForTimeout(500);

    // 检查是否还有弹窗
    const checkResult = await checkForPopupsWithAI(page);

    if (!checkResult.hasPopup) {
      console.log('   ✅ 页面干净，无弹窗遮挡');
      return true;
    }

    console.log(`   ⚠️  检测到弹窗: ${checkResult.description}`);

    // 尝试关闭弹窗
    if (checkResult.suggestedAction === 'click_accept' && checkResult.closeButtonText) {
      // 点击接受按钮
      const clicked = await page.evaluate((btnText) => {
        const buttons = document.querySelectorAll('button, a, [role="button"]');
        for (const btn of buttons) {
          if (btn.textContent?.toLowerCase().includes(btnText.toLowerCase())) {
            btn.click();
            return true;
          }
        }
        return false;
      }, checkResult.closeButtonText);

      if (clicked) {
        console.log(`   ✅ 已点击 "${checkResult.closeButtonText}" 按钮`);
      }
    } else if (checkResult.suggestedAction === 'click_close') {
      // 尝试各种关闭方式
      await dismissModalDialogs(page);
    } else {
      // 默认按 Escape
      await page.keyboard.press('Escape');
      console.log('   ✖️ 已按 Escape');
    }

    await page.waitForTimeout(1000);
  }

  // 最后强制用 CSS 隐藏所有可能的弹窗
  await hideModalsWithCSS(page);
  console.log('   🔧 已应用 CSS 隐藏所有弹窗');
  return true;
}

/**
 * 等待元素内的懒加载内容加载完成
 * 包括：图片、背景图、iframe 等
 */
async function waitForLazyLoad(page, selector, options = {}) {
  const { timeout = 5000, debug = false } = options;

  await page.evaluate(async ({ sel, opts }) => {
    const element = document.querySelector(sel);
    if (!element) return;

    // 1. 找到所有懒加载图片
    const lazyImages = element.querySelectorAll('img[loading="lazy"], img[data-src], img[data-lazy-src], img[src^="data:image"]');

    // 2. 找到所有有 data-src 属性的元素（可能是背景图）
    const lazyBackgrounds = element.querySelectorAll('[data-src], [data-bg], [data-background]');

    // 3. 找到所有 iframe（如视频嵌入）
    const iframes = element.querySelectorAll('iframe[loading="lazy"], iframe[data-src]');

    // 4. 找到所有 video 元素（需要触发加载）
    const videos = element.querySelectorAll('video[preload="none"], video[preload="metadata"]');

    // 5. 强制触发懒加载：移除 loading="lazy" 属性并设置 src
    lazyImages.forEach(img => {
      // 移除 lazy loading 属性
      img.removeAttribute('loading');

      // 如果有 data-src，设置为 src
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
      if (img.dataset.lazySrc) {
        img.src = img.dataset.lazySrc;
      }

      // 如果 src 是 data:image 占位符，尝试获取真实 src
      if (img.src && img.src.startsWith('data:image')) {
        const realSrc = img.dataset.src || img.dataset.lazySrc;
        if (realSrc) {
          img.src = realSrc;
        }
      }

      // 强制显示图片（移除 opacity-0 等隐藏样式）
      if (img.classList.contains('opacity-0')) {
        img.classList.remove('opacity-0');
        img.style.opacity = '1';
      }
    });

    // 6. 触发背景图懒加载
    lazyBackgrounds.forEach(el => {
      if (el.dataset.src) {
        el.style.backgroundImage = `url(${el.dataset.src})`;
      }
      if (el.dataset.bg) {
        el.style.backgroundImage = `url(${el.dataset.bg})`;
      }
    });

    // 7. 触发 iframe 懒加载
    iframes.forEach(iframe => {
      iframe.removeAttribute('loading');
      if (iframe.dataset.src) {
        iframe.src = iframe.dataset.src;
      }
    });

    // 8. 触发视频加载（加载 poster 图片）
    videos.forEach(video => {
      video.preload = 'auto';
      // 触发加载 poster
      if (video.poster) {
        const posterImg = new Image();
        posterImg.src = video.poster;
      }
    });

    // 9. 等待所有图片加载完成
    const allImages = element.querySelectorAll('img');
    const imagePromises = [];

    allImages.forEach(img => {
      // 强制显示所有图片
      const computedStyle = getComputedStyle(img);
      if (computedStyle.opacity === '0') {
        img.style.opacity = '1';
      }

      if (!img.complete && img.src && !img.src.startsWith('data:image')) {
        const promise = new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve; // 即使失败也继续
          // 设置超时
          setTimeout(resolve, 3000);
        });
        imagePromises.push(promise);
      }
    });

    // 等待所有图片加载
    await Promise.all(imagePromises);

    // 10. 额外等待：让 CSS 动画和动态内容完成
    await new Promise(r => setTimeout(r, 500));

  }, { sel: selector, opts: { debug } });

  // 在 Node 端额外等待一下
  await page.waitForTimeout(800);
}

/**
 * 等待页面稳定（无网络请求）
 */
async function waitForPageStable(page, timeout = 5000) {
  const startTime = Date.now();
  let lastRequestTime = Date.now();

  page.on('request', () => {
    lastRequestTime = Date.now();
  });

  while (Date.now() - startTime < timeout) {
    const elapsed = Date.now() - lastRequestTime;
    if (elapsed > 1000) {
      // 1秒内无新请求，认为页面稳定
      return;
    }
    await page.waitForTimeout(200);
  }
}

async function capture() {
  const url = process.argv[2] || 'https://playwright.dev/';
  const publicDir = process.argv[3] || path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  const playwrightTmp = path.join(__dirname, '.playwright-tmp');
  if (!fs.existsSync(playwrightTmp)) fs.mkdirSync(playwrightTmp, { recursive: true });
  process.env.PLAYWRIGHT_BROWSERS_PATH = playwrightTmp;

  console.log(`\n📸 [1/4] 正在访问 ${url} 并深度分析页面...`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();

  // 使用 domcontentloaded 而不是 networkidle，更容忍慢速资源
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // 等待页面稳定
  console.log('   ⏳ 等待页面加载...');
  await page.waitForTimeout(2000);

  // 1. 尝试关闭 Cookie 弹窗
  const cookieClosed = await dismissCookiePopup(page);
  if (!cookieClosed) {
    await page.waitForTimeout(1000);
    await dismissCookiePopup(page);
  }

  // 2. 尝试关闭登录/注册弹窗和其他模态框
  const modalClosed = await dismissModalDialogs(page);
  if (!modalClosed) {
    await page.waitForTimeout(500);
    await dismissModalDialogs(page);
  }

  // 等待页面稳定（网络空闲）
  await waitForPageStable(page, 5000);

  // 在任何操作前记录页面总高度（SPA 页面可能在操作后改变高度）
  const pageTotalHeightForScroll = await page.evaluate(() => {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
  });

  // 3. 用 CSS 隐藏所有可能的弹窗和干扰元素
  await hideModalsWithCSS(page);
  await page.addStyleTag({
    content: `
      /* 额外的干扰元素 */
      iframe, ::-webkit-scrollbar,
      .chat-widget, .livechat, [class*="chat"],
      [class*="intercom"], [class*="Intercom"],
      [class*="drift"], [class*="Drift"],
      [class*="crisp"], [class*="Crisp"],
      [class*="zendesk"], [class*="Zendesk"],
      {
        display: none !important;
        visibility: hidden !important;
      }
    `
  });

  // 等待动态内容加载
  await page.waitForTimeout(2000);

  // 深度提取内容
  console.log('   📝 提取页面内容...');
  const pageContent = await extractPageContent(page);

  // 格式化为 AI 友好的文本
  const formattedContent = formatContentForAI(pageContent);

  // 保存原始数据
  const scrapedData = {
    url: pageContent.url,
    title: pageContent.seo.title,
    description: pageContent.seo.description,
    keywords: pageContent.seo.keywords,
    productName: pageContent.productName,
    // 网站配色 (AI 视频风格用)
    colorPalette: pageContent.colorPalette,
    // 原始数据（供详细分析）
    raw: pageContent,
    // 格式化文本（供 AI 直接使用）
    core_text: formattedContent,
    // 精简版（兼容旧流程）
    headings: [...pageContent.headings.h1, ...pageContent.headings.h2, ...pageContent.headings.h3],
    features: pageContent.features,
    ctaTexts: pageContent.ctaTexts,
  };

  // 检查用户自定义描述
  const customDescription = loadCustomDescription();
  let screenshotStrategy = null;

  if (customDescription) {
    console.log('\n   📝 检测到用户自定义描述，AI 分析截图策略...');
    screenshotStrategy = await analyzeUserDescriptionForScreenshots(customDescription, pageContent);

    if (screenshotStrategy) {
      console.log(`   ✅ AI 建议: ${screenshotStrategy.keyPoints?.slice(0, 3).join(', ')}`);
      console.log(`   🔍 搜索关键词: ${screenshotStrategy.searchKeywords?.slice(0, 3).join(', ')}`);

      // 将截图策略保存到 scrapedData
      scrapedData.screenshotStrategy = screenshotStrategy;
    }
  }

  fs.writeFileSync(path.join(publicDir, 'scraped.json'), JSON.stringify(scrapedData, null, 2));
  console.log('   ✅ 内容提取完成');

  // 输出摘要
  console.log('\n   📊 内容摘要:');
  console.log(`      标题: ${pageContent.seo.title?.substring(0, 50)}...`);
  console.log(`      H1数量: ${pageContent.headings.h1.length}`);
  console.log(`      H2数量: ${pageContent.headings.h2.length}`);
  console.log(`      段落数量: ${pageContent.paragraphs.length}`);
  console.log(`      特性数量: ${pageContent.features.length}`);
  console.log(`      CTA数量: ${pageContent.ctaTexts.length}`);
  if (pageContent.jsonLd.length > 0) {
    console.log(`      结构化数据: ✓ (${pageContent.jsonLd.length}个)`);
  }

  // ========================================
  // DOM 元素精准截图逻辑
  // ========================================
  console.log('\n   📷 开始 DOM 元素精准截图...');

  const viewportHeight = 900;
  const viewportWidth = 1440;
  await page.setViewportSize({ width: viewportWidth, height: viewportHeight });

  // 等待页面内容加载
  await page.waitForTimeout(1000);

  // Step 0: 确保页面干净，无弹窗遮挡
  console.log('   🔍 Step 0: 检查并清除弹窗...');
  await ensureCleanPage(page, 3);

  // Step 0.5: 预触发所有懒加载内容（滚动整个页面）- 在收集候选区块之前
  console.log('   🔄 Step 0.5: 预触发懒加载内容...');
  await page.evaluate(async () => {
    // 滚动整个页面，触发所有懒加载
    const totalHeight = document.body.scrollHeight;
    const viewportHeight = window.innerHeight;
    let currentPos = 0;
    const step = viewportHeight * 0.5;

    // 快速滚动整个页面
    while (currentPos < totalHeight) {
      window.scrollTo(0, currentPos);
      await new Promise(r => setTimeout(r, 100));
      currentPos += step;
    }

    // 滚回顶部
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 300));

    // 强制加载所有懒加载图片
    document.querySelectorAll('img[loading="lazy"], img[data-src]').forEach(img => {
      img.removeAttribute('loading');
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
    });

    // 等待图片加载
    const images = document.querySelectorAll('img');
    await Promise.all([...images].map(img => {
      if (!img.complete && img.src) {
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 2000);
        });
      }
      return Promise.resolve();
    }));
  });
  await page.waitForTimeout(500);
  console.log('   ✅ 懒加载内容已预触发');

  // Step 1: 注入探针，提取候选区块
  console.log('   🔍 Step 1: 注入探针，分析 DOM 结构...');
  let candidates = await injectProbesAndExtractBlocks(page);
  console.log(`   ✅ 发现 ${candidates.length} 个候选区块`);

  // 如果没有找到候选区块，尝试备用方法：查找所有可见的大块元素
  if (candidates.length === 0) {
    console.log('   ⚠️  未找到语义化区块，尝试备用方法...');
    candidates = await page.evaluate(() => {
      const fallbackCandidates = [];
      const allDivs = document.querySelectorAll('div');

      allDivs.forEach((div, index) => {
        const rect = div.getBoundingClientRect();
        const style = getComputedStyle(div);

        // 查找可见的、足够大的块
        if (rect.width > 400 && rect.height > 200 &&
            style.display !== 'none' && style.visibility !== 'hidden' &&
            rect.height < window.innerHeight * 2.0) {

          // 检查是否有实际的文本内容
          const text = (div.innerText || '').trim();
          if (text.length > 20) {
            fallbackCandidates.push({
              id: `fallback-${index}`,
              selector: `div:nth-of-type(${index + 1})`,
              suggestedType: 'content',
              heading: text.substring(0, 50),
              textSummary: text.substring(0, 200),
              width: rect.width,
              height: rect.height,
              aspectRatio: (rect.width / rect.height).toFixed(2)
            });
          }
        }
      });

      return fallbackCandidates.slice(0, 10); // 最多返回10个
    });

    console.log(`   ✅ 备用方法发现 ${candidates.length} 个候选区块`);
  }

  // Step 2: AI 智能挑选
  console.log('   🤖 Step 2: AI 智能挑选最佳区块...');
  let selectedBlocks = await aiSelectBlocks(candidates, pageContent);

  // 【方案 2】后处理：优化定价区块选择
  selectedBlocks = await postProcessSelectedBlocks(selectedBlocks, candidates);

  // 按页面位置从上到下排序（视频顺序）
  selectedBlocks.sort((a, b) => (a.top || 0) - (b.top || 0));

  console.log(`   ✅ AI 选中 ${selectedBlocks.length} 个区块（按页面顺序）:`);
  selectedBlocks.forEach((block, i) => {
    console.log(`      ${i + 1}. [ID:${block.id}] ${block.suggestedType.toUpperCase()} - "${block.heading?.substring(0, 30) || block.textSummary?.substring(0, 30)}..."`);
  });

  // Step 3: 精准截图
  console.log('   📸 Step 3: 精准截取 DOM 元素...');
  const screenshots = [];

  // 用于检测重复截图
  const crypto = require('crypto');
  const screenshotHashes = [];

  // 截图前隐藏悬浮元素（sticky/fixed 导航栏等）
  await page.evaluate(() => {
    const mainElement = document.querySelector('main');
    const allElements = document.querySelectorAll('*');

    let hiddenCount = 0;
    allElements.forEach(el => {
      const style = getComputedStyle(el);
      const position = style.position;

      if (position === 'sticky' || position === 'fixed') {
        if (mainElement && !mainElement.contains(el)) {
          el.setAttribute('data-original-display', style.display);
          el.style.display = 'none';
          hiddenCount++;
        }
      }
    });
    return hiddenCount;
  });
  console.log('   🔒 已隐藏悬浮导航栏等遮挡元素');

  // 创建 debug 目录用于存储所有候选区块截图
  const debugDir = path.join(publicDir, '_debug');
  if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

  // 按页面位置排序候选区块（从上到下）
  const sortedCandidates = [...candidates].sort((a, b) => (a.top || 0) - (b.top || 0));

  // 先截取所有候选区块（用于可视化调试）
  console.log('   📸 截取所有候选区块（调试）...');
  const allScreenshots = [];
  for (let i = 0; i < sortedCandidates.length; i++) {
    const block = sortedCandidates[i];
    try {
      const element = await page.$(block.selector);
      if (!element) continue;

      // 滚动到元素位置
      await element.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      // 等待懒加载内容加载完成
      await waitForLazyLoad(page, block.selector);

      const debugPath = path.join(debugDir, `candidate_${block.id}.png`);
      await element.screenshot({ path: debugPath });

      allScreenshots.push({
        id: block.id,
        type: block.suggestedType,
        heading: block.heading,
        width: block.width,
        height: block.height,
        selected: selectedBlocks.some(s => s.id === block.id),
        path: debugPath
      });
      console.log(`      📷 [${block.id}] ${block.suggestedType} - "${block.heading?.substring(0, 30) || 'N/A'}" ${selectedBlocks.some(s => s.id === block.id) ? '✅' : '❌'}`);
    } catch (err) {
      console.log(`      ⚠️ [${block.id}] 截图失败: ${err.message}`);
    }
  }

  // 生成可视化 HTML
  const selectedIds = selectedBlocks.map(b => b.id);
  const htmlContent = generateVisualizationHTML(candidates, selectedIds, allScreenshots, pageContent);
  fs.writeFileSync(path.join(debugDir, 'visualization.html'), htmlContent);
  console.log(`   ✅ 可视化已生成: ${debugDir}/visualization.html`);

  // 截取 AI 选中的区块（用于生产）
  for (let i = 0; i < selectedBlocks.length; i++) {
    const block = selectedBlocks[i];

    // 使用 Playwright 的 element screenshot
    try {
      const element = await page.$(block.selector);
      if (!element) {
        console.log(`   ⚠️  未找到元素 ${block.selector}，跳过`);
        continue;
      }

      // 确保元素在视口内（触发懒加载）
      await element.scrollIntoViewIfNeeded();

      // 等待懒加载内容加载完成
      await waitForLazyLoad(page, block.selector);

      // 截图前再次强制隐藏所有cookie/弹窗元素
      await page.evaluate(() => {
        // 方法1: 通过选择器移除
        const selectors = [
          '[data-testid*="cookie"]', '[data-testid*="Cookie"]',
          '[id*="cookie"]', '[id*="Cookie"]',
          '[class*="cookie"]', '[class*="Cookie"]',
          '[class*="consent"]', '[class*="Consent"]',
          '.cc-window', '.cc-banner', '#onetrust-banner-sdk',
          '[role="dialog"]', '[class*="modal"]', '[class*="popup"]'
        ];
        selectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => el.remove());
        });

        // 方法2: 通过文本内容和位置检测cookie弹窗（Figma等网站使用动态类名）
        document.querySelectorAll('*').forEach(el => {
          const style = getComputedStyle(el);
          const text = (el.textContent || '').toLowerCase();

          // 检查是否是fixed定位且包含cookie相关文字
          if (style.position === 'fixed' || style.position === 'sticky') {
            if (text.includes('cookie') || text.includes('cookies') ||
                text.includes('we use') && text.includes('data') ||
                text.includes('privacy') && el.offsetWidth > 200) {
              // 确保是在底部或顶部的弹窗
              const rect = el.getBoundingClientRect();
              if (rect.bottom > window.innerHeight - 100 || rect.top < 100) {
                console.log('Removing cookie element:', el.className);
                el.remove();
              }
            }
          }
        });

        // 方法3: 移除所有位于视口底部的fixed元素（可能是cookie弹窗）
        document.querySelectorAll('div[class^="fig-"], div[class*="--"]').forEach(el => {
          const style = getComputedStyle(el);
          if (style.position === 'fixed') {
            const text = (el.textContent || '').toLowerCase();
            if (text.includes('cookie') || text.includes('consent') ||
                text.includes('accept') && text.includes('cookies')) {
              el.remove();
            }
          }
        });
      });
      await page.waitForTimeout(200);

      // 先截图到临时路径
      const tempPath = path.join(publicDir, `_temp_shot.png`);
      await element.screenshot({ path: tempPath });

      // 计算文件 hash 检测重复
      const fileBuffer = fs.readFileSync(tempPath);
      const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
      const fileSize = fileBuffer.length;

      // 检查是否与已有截图重复
      let isDuplicate = false;
      for (const existing of screenshotHashes) {
        if (existing.hash === hash) {
          isDuplicate = true;
          console.log(`   ⚠️  [${i + 1}] 截图内容重复，跳过 (与 ${existing.index} 相同)`);
          break;
        }
        // 也检查文件大小相近的情况（可能内容相似但有细微差异）
        if (Math.abs(existing.size - fileSize) < 1000) {
          // 文件大小差距小于 1KB，可能是相似内容
          console.log(`   ⚠️  [${i + 1}] 截图可能重复 (大小相近 ${fileSize} vs ${existing.size})，但仍保留`);
        }
      }

      if (isDuplicate) {
        // 删除临时文件
        fs.unlinkSync(tempPath);
        continue;
      }

      // 检测内容密度，过滤空白图片
      const contentCheck = await checkScreenshotContentDensity(tempPath);
      if (!contentCheck.isValid) {
        console.log(`   ⚠️  [${i + 1}] ${contentCheck.reason}，跳过`);
        fs.unlinkSync(tempPath);
        continue;
      }

      // 重命名为正式文件
      const shotIndex = screenshots.length + 1;
      const shotPath = path.join(publicDir, `shot${shotIndex}.png`);
      fs.renameSync(tempPath, shotPath);

      // 记录 hash
      screenshotHashes.push({ index: shotIndex, hash, size: fileSize });

      screenshots.push({
        index: shotIndex,
        id: block.id,
        type: block.suggestedType,
        desc: block.heading || block.textSummary?.substring(0, 50) || 'Unknown',
        text: block.textSummary,
        reason: block.reason,
        width: block.width,
        height: block.height
      });

      console.log(`   ✅ [${shotIndex}/${selectedBlocks.length}] ${block.suggestedType.toUpperCase()} (${block.width}x${block.height}) - "${block.heading?.substring(0, 30) || 'N/A'}"`);
    } catch (err) {
      console.log(`   ⚠️  截图失败 [ID:${block.id}]: ${err.message}`);
    }
  }

  // Step 4: 如果截图太少，才使用滚动截图补充
  // 短页面降低最小截图数量要求
  const maxScroll = Math.max(0, pageTotalHeightForScroll - viewportHeight);
  const minScreenshots = maxScroll < 200 ? 2 : 3; // 极短页面只需要2张
  if (screenshots.length < minScreenshots) {
    console.log(`\n   ⚠️  截图仅 ${screenshots.length} 张，尝试滚动截图补充...`);

    // 使用之前记录的页面高度（SPA 页面可能在操作后改变高度）
    const pageHeight = pageTotalHeightForScroll;
    const viewportHeight = 900;

    // 计算需要补充的截图数量
    const needed = minScreenshots - screenshots.length;
    console.log(`   📊 页面高度: ${pageHeight}px, 需要补充: ${needed} 张`);

    // 使用黄金比例分割页面，避免重复内容
    const scrollPositions = [];

    // 计算有效的滚动位置
    const maxScroll = Math.max(0, pageHeight - viewportHeight);
    console.log(`   📊 最大滚动距离: ${maxScroll}px`);

    if (maxScroll < 100) {
      // 极短页面：只截取一次
      console.log(`   📊 极短页面模式 (无需滚动)`);
      scrollPositions.push(0);
    } else if (pageHeight <= viewportHeight * 1.5) {
      // 短页面：分成两到三段
      console.log(`   📊 短页面模式 (高度: ${pageHeight}px)`);
      const segments = Math.min(needed, Math.ceil(pageHeight / (viewportHeight * 0.6)));
      for (let i = 0; i < segments; i++) {
        const pos = Math.round((maxScroll / segments) * i);
        if (pos < maxScroll) {
          scrollPositions.push(pos);
        }
      }
    } else {
      // 正常页面：使用滚动截图
      let pos = viewportHeight * 0.5; // 降低起始位置
      while (scrollPositions.length < needed && pos < pageHeight - viewportHeight * 0.5) {
        scrollPositions.push(Math.round(pos));
        pos += viewportHeight * 0.5; // 每次滚动 50% 视口高度
      }
    }

    console.log(`   📊 滚动位置: ${scrollPositions.join(', ')}px`);

    for (let i = 0; i < scrollPositions.length && screenshots.length < minScreenshots; i++) {
      const scrollY = scrollPositions[i];

      // 滚动到位置
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      await page.waitForTimeout(1500); // 增加等待时间让内容加载

      // 截图前再次强制移除cookie/弹窗元素
      await page.evaluate(() => {
        // 方法1: 通过选择器移除
        const selectors = [
          '[data-testid*="cookie"]', '[data-testid*="Cookie"]',
          '[id*="cookie"]', '[id*="Cookie"]',
          '[class*="cookie"]', '[class*="Cookie"]',
          '[class*="consent"]', '[class*="Consent"]',
          '.cc-window', '.cc-banner', '#onetrust-banner-sdk',
          '[role="dialog"]', '[class*="modal"]', '[class*="popup"]'
        ];
        selectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => el.remove());
        });

        // 方法2: 通过文本内容和位置检测cookie弹窗
        document.querySelectorAll('*').forEach(el => {
          const style = getComputedStyle(el);
          const text = (el.textContent || '').toLowerCase();

          if (style.position === 'fixed' || style.position === 'sticky') {
            if (text.includes('cookie') || text.includes('cookies') ||
                text.includes('we use') && text.includes('data')) {
              const rect = el.getBoundingClientRect();
              if (rect.bottom > window.innerHeight - 100 || rect.top < 100) {
                el.remove();
              }
            }
          }
        });

        // 方法3: 移除Figma等网站的动态类名cookie弹窗
        document.querySelectorAll('div[class^="fig-"], div[class*="--"]').forEach(el => {
          const style = getComputedStyle(el);
          if (style.position === 'fixed') {
            const text = (el.textContent || '').toLowerCase();
            if (text.includes('cookie') || text.includes('consent')) {
              el.remove();
            }
          }
        });
      });
      await page.waitForTimeout(200);

      // 截图
      const shotIndex = screenshots.length + 1;
      const tempPath = path.join(publicDir, `_temp_shot.png`);
      await page.screenshot({ path: tempPath, fullPage: false });

      // 检测重复
      const fileBuffer = fs.readFileSync(tempPath);
      const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
      const fileSize = fileBuffer.length;

      let isDuplicate = false;
      let matchedType = '';
      for (const existing of screenshotHashes) {
        // 精确匹配
        if (existing.hash === hash) {
          isDuplicate = true;
          matchedType = 'hash';
          break;
        }
        // 如果文件大小差距小于 5%，也认为可能重复
        const sizeDiff = Math.abs(existing.size - fileSize) / Math.max(existing.size, fileSize);
        if (sizeDiff < 0.05) {
          isDuplicate = true;
          matchedType = 'size';
          break;
        }
      }

      if (isDuplicate) {
        fs.unlinkSync(tempPath);
        console.log(`   ⚠️  滚动截图重复，跳过 (scroll: ${scrollY}px, size: ${fileSize}, matched: ${matchedType})`);
        // 尝试下一个位置
        const nextPos = scrollY + viewportHeight * 0.5;
        if (nextPos < pageHeight - viewportHeight && scrollPositions.length < 30) {
          scrollPositions.push(Math.round(nextPos));
        }
        continue;
      }

      // 重命名
      const shotPath = path.join(publicDir, `shot${shotIndex}.png`);
      fs.renameSync(tempPath, shotPath);

      screenshotHashes.push({ index: shotIndex, hash, size: fileBuffer.length });

      screenshots.push({
        index: shotIndex,
        type: 'scroll',
        desc: `页面滚动位置 ${scrollY}px`,
        text: '',
        width: viewportWidth,
        height: viewportHeight
      });

      console.log(`   ✅ [补充 ${shotIndex}] 滚动截图 (scroll: ${scrollY}px)`);
    }
  }

  await browser.close();

  // 保存截图描述到 scrapedData
  const screenshotInfo = screenshots.map(s => ({
    file: `shot${s.index}.png`,
    id: s.id,
    type: s.type,
    desc: s.desc,
    text: s.text,
    reason: s.reason,
    width: s.width,
    height: s.height
  }));

  scrapedData.screenshots = screenshotInfo;
  fs.writeFileSync(path.join(publicDir, 'scraped.json'), JSON.stringify(scrapedData, null, 2));

  console.log('\n✅ DOM 元素精准截图完成！');
  console.log('📸 截图摘要:');
  screenshots.forEach(s => console.log(`   shot${s.index}.png - [${s.type}] ${s.desc?.substring(0, 40)} (${s.width}x${s.height})`));
}

capture().catch(err => {
  console.error('❌ 截图失败:', err.message);
  process.exit(1);
});