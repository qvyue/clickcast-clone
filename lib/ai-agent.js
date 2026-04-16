/**
 * @fileoverview AI Agent 核心模块
 * @module lib/ai-agent
 * @description 作为 AI Agent 的"大脑"，负责视频脚本的智能生成
 *
 * 主要功能：
 * 1. 分析网站类型和目标受众
 * 2. 智能决策截图策略
 * 3. 生成视频脚本（标题、副标题、配音文案）
 * 4. 自我修正和质量验证
 * 5. 图片裁切策略分析
 *
 * 主要导出：
 * - runAIAgent: 完整的 AI Agent 流程入口
 * - analyzeWebsiteType: 分析网站类型
 * - generateVideoScript: 生成视频脚本
 * - analyzeImageCropStrategy: 分析图片裁切策略
 */

const fs = require('fs');
const path = require('path');

const { loadEnv } = require('../utils/env');
loadEnv();

const { callAI } = require('../utils/ai-client');

/**
 * 分析网站类型
 * @description 调用 AI 分析网站内容，判断网站类型（SAAS、电商、博客等）
 * @param {Object} scrapedData - 爬取的网站数据
 * @param {string} scrapedData.url - 网站 URL
 * @param {string} scrapedData.title - 页面标题
 * @param {string} scrapedData.description - 页面描述
 * @param {string} scrapedData.core_text - 格式化的页面内容
 * @param {string} scrapedData.productName - 产品名称
 * @param {string[]} scrapedData.features - 功能特性列表
 * @param {string[]} scrapedData.ctaTexts - CTA 按钮文字列表
 * @returns {Promise<Object>} 分析结果
 * @returns {string} returns.type - 网站类型（SAAS/ECOMMERCE/PORTFOLIO/BLOG/LANDING/CORPORATE/TOOL）
 * @returns {number} returns.confidence - 置信度（0-1）
 * @returns {string} returns.suggestedStyle - 建议的视频风格
 * @returns {string} returns.suggestedTone - 建议的语调
 * @returns {string[]} returns.keySellingPoints - 核心卖点
 * @returns {string} returns.targetAudience - 目标受众
 * @returns {string} returns.productCategory - 产品分类
 */
async function analyzeWebsiteType(scrapedData) {
  // 使用增强的内容
  const content = scrapedData.core_text || scrapedData.raw?.headings?.h1?.join(' ') || '';

  const prompt = `Analyze this website and determine its type for video generation.

Website URL: ${scrapedData.url}

=== SEO Meta Data ===
Title: ${scrapedData.title}
Description: ${scrapedData.description}
Keywords: ${scrapedData.keywords || 'N/A'}

=== Page Content Analysis ===
${scrapedData.core_text?.substring(0, 2000) || content}

=== Product Info ===
Product Name: ${scrapedData.productName || 'Unknown'}
Features Found: ${scrapedData.features?.slice(0, 5).join(', ') || 'N/A'}
CTA Buttons: ${scrapedData.ctaTexts?.slice(0, 3).join(', ') || 'N/A'}

Classify into ONE type:
- SAAS: Software as a Service products
- ECOMMERCE: Online stores
- PORTFOLIO: Personal/company portfolios
- BLOG: Content/blogs
- LANDING: Product landing pages
- CORPORATE: Company websites
- TOOL: Online tools/utilities

Output JSON:
{
  "type": "SAAS",
  "confidence": 0.9,
  "suggestedStyle": "modern-tech",
  "suggestedTone": "professional",
  "keySellingPoints": ["point1", "point2", "point3"],
  "targetAudience": "developers",
  "productCategory": "developer tools",
  "mainValueProposition": "Brief description of main value"
}`;

  return callAI(prompt);
}

/**
 * 智能截图策略决策
 * @description 根据网站内容决定最佳截图策略，生成截图建议列表
 * @param {Object} scrapedData - 爬取的网站数据
 * @param {Object} websiteType - 网站类型分析结果
 * @returns {Promise<Object>} 截图策略
 * @returns {Array} returns.screenshots - 截图建议列表
 * @returns {number} returns.totalRecommended - 推荐的截图总数
 */
async function decideScreenshotStrategy(scrapedData, websiteType) {
  const prompt = `Based on this website, decide the optimal screenshot strategy for a marketing video.

Website Type: ${websiteType.type}
Title: ${scrapedData.title}
Content: ${scrapedData.core_text?.substring(0, 500)}

Decide 5-6 screenshot moments that would best showcase this website.
For each screenshot, specify:
1. What content should be captured
2. Why it's important for the video
3. Suggested scroll position or element to focus on

Output JSON:
{
  "screenshots": [
    {
      "order": 1,
      "focus": "Hero section with main headline",
      "reason": "First impression, shows value proposition",
      "suggestedSelector": "header + *",
      "priority": "high"
    }
  ],
  "totalRecommended": 5
}`;

  return callAI(prompt);
}

/**
 * 分析截图内容（多模态理解）
 * @description 分析截图内容，生成标签和配音建议
 * @note 由于 DeepSeek 不支持视觉，此函数使用文本描述分析
 * @param {string[]} screenshotPaths - 截图文件路径列表
 * @returns {Promise<Object>} 分析结果
 * @returns {Array} returns.analysis - 每张截图的分析
 * @returns {string} returns.overallQuality - 整体质量评估
 * @returns {string[]} returns.suggestions - 改进建议
 */
async function analyzeScreenshots(screenshotPaths) {
  // 由于 DeepSeek 不支持视觉，我们用文本描述截图内容
  // 如果有支持视觉的 API，可以传入图片

  const prompt = `Analyze these screenshots for a marketing video.

Screenshot files: ${screenshotPaths.join(', ')}

For each screenshot, provide:
1. A short label (2-4 words)
2. What key information it shows
3. Whether it's good quality for a video
4. Suggested voiceover text (3-6 words, punchy)

Output JSON:
{
  "analysis": [
    {
      "file": "shot1.png",
      "label": "Hero Section",
      "keyInfo": "Main product headline",
      "quality": "good",
      "voiceover": "Your AI Assistant"
    }
  ],
  "overallQuality": "good",
  "suggestions": []
}`;

  return callAI(prompt);
}

/**
 * 读取用户自定义描述
 * @description 从 public/custom-description.txt 读取用户提供的自定义描述
 * @returns {string|null} 用户描述文本，文件不存在或读取失败返回 null
 */
function loadCustomDescription() {
  const descPath = path.join(__dirname, 'public', 'custom-description.txt');
  if (fs.existsSync(descPath)) {
    try {
      const content = fs.readFileSync(descPath, 'utf-8').trim();
      // 读取后删除文件，避免影响下次生成
      fs.unlinkSync(descPath);
      return content;
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * 生成视频脚本（核心创作函数）
 * @description 调用 AI 生成完整的视频脚本，包括场景、文案、布局决策
 * @param {Object} scrapedData - 爬取的网站数据
 * @param {Object} websiteType - 网站类型分析结果
 * @param {Object} screenshotAnalysis - 截图分析结果
 * @returns {Promise<Object>} 视频脚本
 * @returns {string} returns.product - 产品名称
 * @returns {string} returns.tagline - 标语
 * @returns {string} returns.style - 视频风格
 * @returns {Array} returns.scenes - 场景列表
 */
async function generateVideoScript(scrapedData, websiteType, screenshotAnalysis) {
  // 构建丰富的上下文
  const context = [];

  // 基础信息
  context.push(`PRODUCT: ${scrapedData.productName || websiteType.productCategory || 'This Product'}`);
  context.push(`URL: ${scrapedData.url}`);

  // 用户自定义描述 (高优先级)
  const customDesc = loadCustomDescription();
  if (customDesc) {
    context.push(`\n=== WEBSITE OWNER'S KEY REQUIREMENTS (HIGH PRIORITY) ===`);
    context.push(customDesc);
    context.push(`\nNote: The above is provided by the website owner. Make sure to highlight these key points in the video.`);
  }

  // SEO 信息
  if (scrapedData.description) {
    context.push(`OFFICIAL DESCRIPTION: ${scrapedData.description}`);
  }

  // 核心内容
  if (scrapedData.core_text) {
    context.push(`WEBSITE CONTENT:\n${scrapedData.core_text.substring(0, 2500)}`);
  }

  // 行业研究信息 (新增)
  if (scrapedData.industryResearch) {
    const research = scrapedData.industryResearch;
    context.push(`\n=== INDUSTRY RESEARCH ===`);

    if (research.keywords?.industry) {
      context.push(`INDUSTRY: ${research.keywords.industry.join(' / ')}`);
    }
    if (research.keywords?.competitors?.length > 0) {
      context.push(`COMPETITORS: ${research.keywords.competitors.slice(0, 5).join(', ')}`);
    }
    if (research.keywords?.trends?.length > 0) {
      context.push(`MARKET TRENDS: ${research.keywords.trends.join(', ')}`);
    }
    if (research.searchResults?.length > 0) {
      context.push(`MARKET INSIGHTS:`);
      research.searchResults.forEach((r, i) => {
        context.push(`  ${i + 1}. ${r.result?.substring(0, 200)}`);
      });
    }
  }

  // 截图信息 - 让 AI 知道每张截图的内容
  let screenshotContext = '';
  if (scrapedData.screenshots && scrapedData.screenshots.length > 0) {
    const screenshotList = scrapedData.screenshots.map(s => {
      if (s.matchedTerm) {
        return `${s.file}: [${s.type || s.desc}] (matched: "${s.matchedTerm}")`;
      }
      return `${s.file}: [${s.type || s.desc}] - ${s.text?.substring(0, 50) || ''}`;
    }).join('\n  ');
    screenshotContext = `\n=== AVAILABLE SCREENSHOTS (Each screenshot can only be used ONCE!) ===\n  ${screenshotList}\n\nCRITICAL RULES:\n1. Each screenshot must be used at most ONCE - NO duplicates allowed!\n2. Match each scene with the MOST RELEVANT screenshot based on content.\n3. The screenshot field must be exactly the filename from the list above.\n4. If a scene is about features, use a "features" type screenshot.\n5. If a scene is about testimonials, use a "testimonials" type screenshot.`;
  }

  const prompt = `You are an elite video marketing AI Agent. Create a compelling short video script.

=== WEBSITE ANALYSIS ===
Type: ${websiteType.type}
Target Audience: ${websiteType.targetAudience || 'General users'}
Tone: ${websiteType.suggestedTone || 'professional'}
Category: ${websiteType.productCategory || 'Product'}
Key Selling Points: ${(websiteType.keySellingPoints || []).join(', ')}

=== CONTENT CONTEXT ===
${context.join('\n\n')}
${screenshotContext}

=== VIDEO REQUIREMENTS ===
1. Create 4-5 scenes (keep it SHORT for TikTok/Reels style)
2. Each title: 3-5 words MAX, punchy and attention-grabbing
3. Voiceover: ONLY speak the title, nothing more (short and powerful)
4. Each scene should highlight ONE key benefit/feature
5. Order: Hook → Value Props → Social Proof → CTA
6. Use industry insights to make the script more relevant and competitive
7. IMPORTANT: If "WEBSITE OWNER'S KEY REQUIREMENTS" section exists above, prioritize those points!
   - Merge owner's requirements with AI-extracted insights
   - Ensure key features mentioned by owner appear in the video
   - Combine human input with AI analysis for best results
8. CRITICAL: Match each scene with the MOST RELEVANT screenshot from the available screenshots list above.
   - If a scene discusses a feature that was captured in a specific screenshot, use that screenshot
   - The screenshot field must be exactly the filename from the available screenshots (e.g., "shot2.png")

=== OUTPUT FORMAT ===
{
  "product": "Product Name",
  "tagline": "Short catchy tagline (under 8 words)",
  "style": "modern-tech",
  "scenes": [
    {
      "id": "intro",
      "title": "Hook Title Here",
      "subText": "Supporting text",
      "screenshot": "shot1.png",
      "voiceover": "Hook Title Here",
      "type": "hook",
      "layout": "center",
      "imageImportance": "high",
      "layoutReason": "Short title + important hero image"
    },
    {
      "id": "scene0",
      "title": "Feature 1",
      "subText": "Benefit description",
      "screenshot": "shot2.png",
      "voiceover": "Feature 1",
      "type": "value",
      "layout": "left",
      "imageImportance": "medium",
      "layoutReason": "Medium text + feature screenshot"
    }
  ]
}

=== LAYOUT DECISION RULES (CRITICAL!) ===
For each scene, you MUST decide:
1. "layout": "left", "right", or "center"
2. "imageImportance": "high", "medium", or "low"
3. "layoutReason": brief explanation

DECISION LOGIC:
- Calculate total text length = title + subText
- SHORT TEXT (≤40 chars) + HIGH image importance → "left" or "right" (gives image more space)
- LONG TEXT (>80 chars) + HIGH image importance → "center" (preserves image, stacks text)
- LONG TEXT (>80 chars) + LOW image importance → "left" or "right" + image will be smaller
- MEDIUM TEXT (40-80 chars) → "center" is safest, or "left"/"right" if image is not critical

IMAGE IMPORTANCE GUIDE:
- HIGH: hero sections, product screenshots, key UI, testimonials with faces
- MEDIUM: feature lists, pricing tables, secondary content
- LOW: decorative screenshots, background elements

CRITICAL: When text is long AND image is important, use "center" layout to prevent image from being cut off!`;

  return callAI(prompt);
}

/**
 * 自我修正脚本问题
 * @description 根据 AI 的质量检查结果，自动修正脚本中的问题
 * @param {Object} script - 原始脚本
 * @param {Object} validation - 质量检查结果
 * @param {boolean} validation.passed - 是否通过检查
 * @param {number} validation.score - 质量评分（0-100）
 * @param {string[]} validation.issues - 问题列表
 * @param {string[]} validation.suggestions - 建议列表
 * @returns {Promise<Object>} 修正后的脚本
 */
async function fixScriptIssues(script, validation) {
  // 如果评分足够高，直接返回原脚本
  if (validation.passed && validation.score >= 80) {
    return script;
  }

  const prompt = `Fix the issues in this video script.

Original Script:
${JSON.stringify(script, null, 2)}

Issues Found:
${validation.issues.join('\n')}
${validation.suggestions.join('\n')}

Output the CORRECTED script in the same JSON format.`;

  return callAI(prompt);
}

/**
 * 完整的 AI Agent 流程入口
 * @description 执行完整的 AI Agent 流程：网站分析 → 风格生成 → 脚本创作 → 质量检查
 * @param {Object} scrapedData - 爬取的网站数据
 * @param {string[]} screenshotPaths - 截图文件路径列表
 * @returns {Promise<Object>} 完整的分析结果
 * @returns {Object} returns.websiteType - 网站类型分析
 * @returns {Object} returns.script - 视频脚本
 * @returns {Object} returns.style - 视频风格
 * @returns {Object} returns.validation - 质量检查结果
 */
async function runAIAgent(scrapedData, screenshotPaths) {
  console.log('\n🤖 AI Agent 开始分析...');
  console.log(`   🔧 runAIAgent 参数: scrapedData=${scrapedData ? '有' : '无'}, screenshots=${screenshotPaths?.length || 0}个`);

  // 检查是否有用户自定义描述
  const descPath = path.join(__dirname, 'public', 'custom-description.txt');
  console.log(`   🔧 检查自定义描述: ${descPath}`);
  if (fs.existsSync(descPath)) {
    console.log('   📝 检测到用户自定义描述，将融合到AI分析中');
  }

  // 1. 分析网站类型 - 添加 try-catch
  console.log('   📊 分析网站类型...');
  let websiteType = null;
  try {
    websiteType = await analyzeWebsiteType(scrapedData);
    if (websiteType) {
      console.log(`   ✅ 网站类型: ${websiteType.type} (置信度: ${Math.round((websiteType.confidence || 0.8) * 100)}%)`);
    }
  } catch (e) {
    console.log(`   ⚠️ 网站类型分析失败: ${e.message}`);
    // 使用默认值继续
    websiteType = {
      type: 'SAAS',
      suggestedStyle: 'modern',
      suggestedTone: 'professional',
      keySellingPoints: [],
      confidence: 0.5
    };
  }

  // 1.5. 生成视频风格 - 添加 try-catch
  console.log('   🎨 生成视频风格...');
  let videoStyle = null;
  try {
    console.log('   🔧 加载 style-generator.js...');
    const { generateVideoStyle } = require('./style-generator.js');
    console.log('   🔧 style-generator.js 加载成功');
    videoStyle = await generateVideoStyle(scrapedData, websiteType?.type);
  } catch (e) {
    console.log(`   ⚠️ 视频风格生成失败: ${e.message}`);
    // 使用默认风格
    videoStyle = {
      name: 'default',
      colors: {
        primary: '#9b4dff',
        secondary: '#6b21a8',
        accent: '#d480ff',
        background: '#05010d',
        text: '#ffffff'
      }
    };
  }

  // 2. 生成脚本 (核心步骤) - 添加 try-catch
  console.log('   ✍️ 生成视频脚本...');
  let script = null;
  try {
    script = await generateVideoScript(
      scrapedData,
      websiteType || { type: 'SAAS', suggestedStyle: 'modern', suggestedTone: 'professional', keySellingPoints: [] },
      { analysis: [] }
    );
  } catch (e) {
    console.log(`   ⚠️ AI 脚本生成失败: ${e.message}`);
  }

  // 处理 AI 返回数组的情况（直接返回 scenes 数组而不是完整对象）
  if (Array.isArray(script)) {
    console.log('   🔧 AI 返回了数组，转换为标准格式');
    script = {
      product: scrapedData.productName || 'This Product',
      tagline: scrapedData.description || 'Amazing Solution',
      scenes: script
    };
  }

  // AI 生成失败的降级处理
  if (!script) {
    console.log('   ⚠️ AI Agent 生成失败，使用基础生成器');
    try {
      const { generateScript } = require('./ai-analyze.js');
      script = await generateScript(scrapedData);
    } catch (e) {
      console.log(`   ⚠️ 基础生成器也失败: ${e.message}`);
      // 创建最小可用脚本
      script = {
        product: scrapedData.productName || 'This Product',
        tagline: scrapedData.description || 'Amazing Solution',
        scenes: [
          {
            id: 'intro',
            title: scrapedData.productName || 'Welcome',
            subText: scrapedData.description || '',
            voiceover: scrapedData.productName || 'Welcome',
            type: 'hook',
            layout: 'center',
            imageImportance: 'high'
          }
        ]
      };
    }
  }

  // 将风格信息添加到脚本
  if (script && videoStyle) {
    script.style = videoStyle;
  }

  // 3.5. 验证并修复截图重复问题
  if (script && script.scenes) {
    const fixResult = ensureUniqueScreenshots(script, scrapedData.screenshots || []);
    if (fixResult.fixed) {
      console.log(`   🔧 自动修复截图重复: ${fixResult.changes.join(', ')}`);
    }
  }

  // 3. 质量检查 (本地检查，不调用 API)
  console.log('   🔍 质量检查...');
  const validation = validateVideoScriptLocal(script);
  console.log(`   ✅ 质量评分: ${validation.score}/100`);

  console.log('   ✅ AI Agent 分析完成');

  return {
    websiteType,
    script,
    style: videoStyle,
    validation
  };
}

/**
 * 确保每个场景使用唯一的截图
 * @description 检查并修复截图重复问题，确保每个场景使用有效的截图
 * @param {Object} script - 视频脚本
 * @param {Array} availableScreenshots - 可用的截图列表
 * @returns {Object} 修复结果
 * @returns {boolean} returns.fixed - 是否进行了修复
 * @returns {string[]} returns.changes - 修复记录列表
 */
function ensureUniqueScreenshots(script, availableScreenshots) {
  if (!script || !script.scenes) return { fixed: false, changes: [] };

  const changes = [];
  const usedScreenshots = new Set();
  const screenshotFiles = availableScreenshots.map(s => s.file || s);

  // 如果没有可用截图，返回
  if (screenshotFiles.length === 0) {
    console.log('   ⚠️ 没有可用的截图');
    return { fixed: false, changes: [] };
  }

  console.log(`   📸 可用截图: ${screenshotFiles.join(', ')}`);

  script.scenes.forEach((scene, index) => {
    // 兼容 screenshot 和 img 两种字段名
    const screenshotField = scene.screenshot || scene.img;

    // 检查截图是否存在
    const screenshotExists = screenshotFiles.includes(screenshotField);
    // 检查是否已被使用
    const isDuplicate = usedScreenshots.has(screenshotField);

    if (!screenshotExists || isDuplicate) {
      // 找一个未使用的截图
      const unusedScreenshot = screenshotFiles.find(s => !usedScreenshots.has(s));
      if (unusedScreenshot) {
        const reason = !screenshotExists ? '不存在' : '重复';
        changes.push(`${scene.id}: ${screenshotField} -> ${unusedScreenshot} (${reason})`);
        // 同时更新两个字段
        scene.screenshot = unusedScreenshot;
        scene.img = unusedScreenshot;
        usedScreenshots.add(unusedScreenshot);
      } else {
        // 没有更多截图，使用一个和上一个不同的截图
        const prevScene = script.scenes[index - 1];
        const prevScreenshot = prevScene?.screenshot || prevScene?.img || '';
        const altScreenshots = screenshotFiles.filter(s => s !== prevScreenshot);
        if (altScreenshots.length > 0) {
          const altScreenshot = altScreenshots[Math.floor(Math.random() * altScreenshots.length)];
          changes.push(`${scene.id}: ${screenshotField} -> ${altScreenshot} (reused)`);
          scene.screenshot = altScreenshot;
          scene.img = altScreenshot;
        }
      }
    } else {
      usedScreenshots.add(screenshotField);
    }
  });

  return { fixed: changes.length > 0, changes };
}

/**
 * 本地质量检查（不调用 API）
 * @description 对生成的脚本进行本地质量检查，包括场景数量、标题长度等
 * @param {Object} script - 视频脚本
 * @returns {Object} 检查结果
 * @returns {boolean} returns.passed - 是否通过检查
 * @returns {number} returns.score - 质量评分（0-100）
 * @returns {string[]} returns.issues - 问题列表
 * @returns {string[]} returns.suggestions - 建议列表
 */
function validateVideoScriptLocal(script) {
  let score = 100;
  const issues = [];

  // 检查场景是否存在
  if (!script || !script.scenes || script.scenes.length === 0) {
    issues.push('No scenes defined');
    score -= 50;
  }

  // 检查每个场景的标题长度
  if (script.scenes) {
    script.scenes.forEach((scene, i) => {
      if (scene.title) {
        const wordCount = scene.title.split(/\s+/).length;
        if (wordCount > 8) {
          issues.push(`Scene ${i}: Title too long (${wordCount} words)`);
          score -= 5;
        }
      }
    });
  }

  return {
    passed: issues.length === 0,
    score: Math.max(0, score),
    issues,
    suggestions: []
  };
}

/**
 * AI 智能分析图片裁切策略
 * @description 分析每张截图的内容，决定最佳的显示方式（contain/cover、焦点区域等）
 * @param {Array} screenshots - 截图列表
 * @param {string} screenshots[].file - 截图文件名
 * @param {number} screenshots[].width - 截图宽度
 * @param {number} screenshots[].height - 截图高度
 * @param {string} screenshots[].type - 截图类型
 * @param {string} screenshots[].desc - 截图描述
 * @returns {Promise<Array>} 裁切策略列表
 */
async function analyzeImageCropStrategy(screenshots) {
  if (!screenshots || screenshots.length === 0) {
    return [];
  }

  const prompt = `You are an expert image analysts. Analyze these screenshots and decide the best way to display each one in a video WITHOUT losing important content.

SCREENSHOTS TO ANALYZE:
${screenshots.map((s, i) => `
[${i + 1}] ${s.file}
  - Dimensions: ${s.width}x${s.height}
  - Aspect Ratio: ${(s.width / s.height).toFixed(2)}
  - Type: ${s.type || 'unknown'}
  - Description: ${s.desc || 'N/A'}
`).join('\n')}

VIDEO CONTAINER: 16:10 aspect ratio (1440x900)

TASK: For each screenshot, determine the best display strategy. Output ONLY a JSON array, no markdown, no explanation.

Each item must have:
- "file": the screenshot filename
- "fitMode": "contain" (show all, safest) or "cover" (fill container, may crop)
- "focusArea": "center", "top", "bottom", "left", or "right"
- "safeZone": number 50-100 (percentage that must not be cropped)

CRITICAL: Output ONLY valid JSON array, nothing else. Example:
[{"file":"shot1.png","fitMode":"contain","focusArea":"center","safeZone":100}]`;

  try {
    const result = await callAI(prompt);

    // 尝试多种方式解析 JSON
    let parsed = null;

    // 1. 如果已经是数组
    if (Array.isArray(result)) {
      return result;
    }

    // 2. 如果是字符串，尝试直接解析
    if (typeof result === 'string') {
      // 移除可能的 markdown 代码块标记
      let cleanStr = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      // 提取 JSON 数组
      const jsonMatch = cleanStr.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    }

    // 3. 如果是对象，检查是否有数组属性
    if (parsed === null && result && typeof result === 'object') {
      // 可能是 { result: [...] } 或类似结构
      for (const key of Object.keys(result)) {
        if (Array.isArray(result[key])) {
          parsed = result[key];
          break;
        }
      }
    }

    if (parsed && Array.isArray(parsed)) {
      // 验证并规范化每个项
      return parsed.map((item, i) => ({
        file: item.file || screenshots[i]?.file || `shot${i + 1}.png`,
        fitMode: ['contain', 'cover'].includes(item.fitMode) ? item.fitMode : 'contain',
        focusArea: ['center', 'top', 'bottom', 'left', 'right'].includes(item.focusArea) ? item.focusArea : 'center',
        safeZone: typeof item.safeZone === 'number' ? Math.min(100, Math.max(50, item.safeZone)) : 100,
        reasoning: item.reasoning || 'AI analyzed'
      }));
    }
  } catch (e) {
    console.log(`   ⚠️ AI 裁切分析失败: ${e.message}`);
  }

  // 默认策略：保守处理，使用 contain
  return screenshots.map(s => ({
    file: s.file,
    fitMode: 'contain',
    focusArea: 'center',
    safeZone: 100,
    reasoning: 'Default safe strategy - show entire image'
  }));
}

// 命令行测试入口
if (require.main === module) {
  console.log('请通过 pipeline.js 运行');
}

// 模块导出
module.exports = {
  analyzeWebsiteType,
  decideScreenshotStrategy,
  analyzeScreenshots,
  generateVideoScript,
  fixScriptIssues,
  runAIAgent,
  callAI,
  analyzeImageCropStrategy
};
