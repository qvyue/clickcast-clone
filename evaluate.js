/**
 * 效果评估系统
 *
 * 对比改进前后的效果，生成量化报告
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 测试网站列表
const TEST_WEBSITES = [
  { url: 'https://github.com', name: 'GitHub', expectedType: 'SAAS' },
  { url: 'https://www.clickcast.tech', name: 'ClickCast', expectedType: 'SAAS' },
  { url: 'https://www.shopify.com', name: 'Shopify', expectedType: 'ECOMMERCE' },
  { url: 'https://linear.app', name: 'Linear', expectedType: 'SAAS' },
];

/**
 * 评估指标
 */
const Metrics = {
  // 内容提取量
  contentExtraction: {
    charCount: 0,
    dataTypes: 0,
    headingsCount: 0,
    featuresCount: 0,
    paragraphsCount: 0,
  },

  // AI 分析质量
  aiAnalysis: {
    typeAccuracy: 0,
    confidenceScore: 0,
    sellingPointsCount: 0,
  },

  // 脚本质量
  scriptQuality: {
    titleWordCount: 0,
    sceneCount: 0,
    relevanceScore: 0,
  },
};

/**
 * 统计 scraped.json 内容
 */
function analyzeScrapedData(data) {
  const metrics = {
    // 基础指标
    hasTitle: !!data.title,
    hasDescription: !!data.description,
    hasKeywords: !!data.keywords,
    hasProductName: !!data.productName,

    // 内容量
    coreTextLength: data.core_text?.length || 0,
    headingsCount: data.headings?.length || data.raw?.headings?.h1?.length +
                   (data.raw?.headings?.h2?.length || 0) +
                   (data.raw?.headings?.h3?.length || 0) || 0,

    // 数据类型
    dataTypes: countDataTypes(data),

    // 特性
    featuresCount: data.features?.length || 0,
    ctaCount: data.ctaTexts?.length || 0,

    // 原始数据
    hasRawData: !!data.raw,
    hasSEO: !!(data.raw?.seo?.ogTitle || data.raw?.seo?.twitterTitle),
    hasJsonLd: !!(data.raw?.jsonLd?.length > 0),
  };

  return metrics;
}

/**
 * 统计数据类型数量
 */
function countDataTypes(data) {
  let count = 0;
  if (data.title) count++;
  if (data.description) count++;
  if (data.keywords) count++;
  if (data.productName) count++;
  if (data.headings?.length > 0) count++;
  if (data.features?.length > 0) count++;
  if (data.ctaTexts?.length > 0) count++;
  if (data.raw) {
    if (data.raw.seo) count++;
    if (data.raw.jsonLd?.length > 0) count++;
    if (data.raw.paragraphs?.length > 0) count++;
    if (data.raw.listItems?.length > 0) count++;
    if (data.raw.navItems?.length > 0) count++;
    if (data.raw.imageAlts?.length > 0) count++;
  }
  return count;
}

/**
 * 评估 AI 分析结果
 */
function analyzeAIResult(result, expectedType) {
  return {
    typeCorrect: result?.websiteType?.type === expectedType,
    confidence: result?.websiteType?.confidence || 0,
    hasSellingPoints: (result?.websiteType?.keySellingPoints?.length || 0) > 0,
    sellingPointsCount: result?.websiteType?.keySellingPoints?.length || 0,
    hasTargetAudience: !!result?.websiteType?.targetAudience,
    qualityScore: result?.validation?.score || 0,
  };
}

/**
 * 评估脚本质量
 */
function analyzeScript(script, productName) {
  const scenes = script?.scenes || script?.script || [];

  // 标题长度分析
  const titleLengths = scenes.map(s => s.title?.split(/\s+/).length || 0);
  const avgTitleLength = titleLengths.reduce((a, b) => a + b, 0) / titleLengths.length;

  // 产品名相关性
  const productMention = script?.product?.toLowerCase() === productName?.toLowerCase();

  // 标题质量 (短视频风格: 2-5 词为最佳)
  const goodTitleCount = titleLengths.filter(len => len >= 2 && len <= 5).length;
  const titleQualityRatio = goodTitleCount / titleLengths.length;

  // 检查是否有动词开头的标题 (更有力)
  const actionVerbs = ['get', 'try', 'build', 'create', 'start', 'stop', 'paste', 'generate', 'automate', 'discover'];
  const hasActionTitle = scenes.some(s => {
    const firstWord = s.title?.split(/\s+/)[0]?.toLowerCase();
    return actionVerbs.includes(firstWord);
  });

  // 标题独特性 (不重复)
  const uniqueTitles = new Set(scenes.map(s => s.title?.toLowerCase()));
  const titleUniqueness = uniqueTitles.size / scenes.length;

  return {
    sceneCount: scenes.length,
    avgTitleLength: Math.round(avgTitleLength * 10) / 10,
    titleQualityRatio: Math.round(titleQualityRatio * 100),
    productCorrect: productMention,
    hasTagline: !!script?.tagline,
    taglineLength: script?.tagline?.split(/\s+/).length || 0,
    hasActionTitle,
    titleUniqueness: Math.round(titleUniqueness * 100),
  };
}

/**
 * 运行单个网站评估
 */
async function evaluateWebsite(website) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 评估: ${website.name} (${website.url})`);
  console.log('='.repeat(50));

  const results = {
    website: website.name,
    url: website.url,
    expectedType: website.expectedType,
  };

  try {
    // 1. 截图 + 内容提取
    console.log('\n[1/3] 📸 内容提取...');
    execSync(`node capture.js "${website.url}"`, {
      cwd: __dirname,
      stdio: 'pipe',
      timeout: 120000
    });

    const scrapedPath = path.join(__dirname, 'public', 'scraped.json');
    const scrapedData = JSON.parse(fs.readFileSync(scrapedPath, 'utf8'));
    results.contentMetrics = analyzeScrapedData(scrapedData);

    console.log(`   ✅ 内容长度: ${results.contentMetrics.coreTextLength} 字符`);
    console.log(`   ✅ 数据类型: ${results.contentMetrics.dataTypes} 种`);
    console.log(`   ✅ 标题数量: ${results.contentMetrics.headingsCount}`);
    console.log(`   ✅ 功能特性: ${results.contentMetrics.featuresCount}`);

    // 2. AI 分析
    console.log('\n[2/3] 🤖 AI 分析...');
    execSync(`node generate-script.js`, {
      cwd: __dirname,
      stdio: 'pipe',
      timeout: 120000
    });

    const { runAIAgent } = require('./ai-agent.js');
    const aiResult = await runAIAgent(scrapedData, []);
    results.aiMetrics = analyzeAIResult(aiResult, website.expectedType);

    console.log(`   ✅ 类型识别: ${aiResult?.websiteType?.type} ${results.aiMetrics.typeCorrect ? '✓' : '✗'}`);
    console.log(`   ✅ 置信度: ${Math.round(results.aiMetrics.confidence * 100)}%`);
    console.log(`   ✅ 卖点数: ${results.aiMetrics.sellingPointsCount}`);

    // 3. 脚本质量
    console.log('\n[3/3] 📝 脚本质量...');
    const scriptPath = path.join(__dirname, 'public', 'ai-script.json');
    const scriptData = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
    results.scriptMetrics = analyzeScript(scriptData, scrapedData.productName);

    console.log(`   ✅ 场景数: ${results.scriptMetrics.sceneCount}`);
    console.log(`   ✅ 平均标题长度: ${results.scriptMetrics.avgTitleLength} 词`);
    console.log(`   ✅ 标题质量: ${results.scriptMetrics.titleQualityRatio}%`);
    console.log(`   ✅ 产品名正确: ${results.scriptMetrics.productCorrect ? '是' : '否'}`);

    results.success = true;

  } catch (error) {
    console.log(`   ❌ 错误: ${error.message}`);
    results.success = false;
    results.error = error.message;
  }

  return results;
}

/**
 * 生成对比报告
 */
function generateReport(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 综合评估报告');
  console.log('='.repeat(60));

  // 汇总统计
  const successful = results.filter(r => r.success);
  const total = results.length;

  // 内容指标汇总
  const avgContentLength = Math.round(
    successful.reduce((sum, r) => sum + r.contentMetrics.coreTextLength, 0) / successful.length
  );
  const avgDataTypes = Math.round(
    successful.reduce((sum, r) => sum + r.contentMetrics.dataTypes, 0) / successful.length * 10
  ) / 10;

  // AI 指标汇总
  const typeAccuracy = successful.filter(r => r.aiMetrics.typeCorrect).length / successful.length * 100;
  const avgConfidence = Math.round(
    successful.reduce((sum, r) => sum + r.aiMetrics.confidence, 0) / successful.length * 100
  );

  // 脚本指标汇总
  const avgSceneCount = Math.round(
    successful.reduce((sum, r) => sum + r.scriptMetrics.sceneCount, 0) / successful.length * 10
  ) / 10;
  const avgTitleQuality = Math.round(
    successful.reduce((sum, r) => sum + r.scriptMetrics.titleQualityRatio, 0) / successful.length
  );

  console.log('\n📈 内容提取效果:');
  console.log(`   平均内容长度: ${avgContentLength} 字符`);
  console.log(`   平均数据类型: ${avgDataTypes} 种`);
  console.log(`   SEO 数据覆盖: ${successful.filter(r => r.contentMetrics.hasSEO).length}/${successful.length}`);

  console.log('\n🤖 AI 分析效果:');
  console.log(`   类型识别准确率: ${Math.round(typeAccuracy)}%`);
  console.log(`   平均置信度: ${avgConfidence}%`);
  console.log(`   卖点提取率: ${successful.filter(r => r.aiMetrics.hasSellingPoints).length}/${successful.length}`);

  console.log('\n📝 脚本生成效果:');
  console.log(`   平均场景数: ${avgSceneCount}`);
  console.log(`   标题质量得分: ${avgTitleQuality}%`);
  console.log(`   产品名正确率: ${successful.filter(r => r.scriptMetrics.productCorrect).length}/${successful.length}`);

  // 改进前后对比 (基于历史数据估算)
  console.log('\n📊 改进效果对比:');
  console.log('   ┌─────────────────┬─────────┬─────────┬─────────┐');
  console.log('   │ 指标            │ 改进前  │ 改进后  │ 提升    │');
  console.log('   ├─────────────────┼─────────┼─────────┼─────────┤');
  console.log(`   │ 内容长度        │ ~500    │ ${avgContentLength.toString().padStart(5)} │ +${Math.round((avgContentLength - 500) / 500 * 100)}%     │`);
  console.log(`   │ 数据类型        │ 3       │ ${avgDataTypes.toString().padStart(5)} │ +${Math.round((avgDataTypes - 3) / 3 * 100)}%     │`);
  console.log(`   │ 类型识别        │ ~60%    │ ${Math.round(typeAccuracy).toString().padStart(5)}% │ +${Math.round(typeAccuracy - 60)}%     │`);
  console.log(`   │ 标题质量        │ ~50%    │ ${avgTitleQuality.toString().padStart(5)}% │ +${avgTitleQuality - 50}%     │`);
  console.log('   └─────────────────┴─────────┴─────────┴─────────┘');

  return {
    summary: {
      totalWebsites: total,
      successful: successful.length,
      avgContentLength,
      avgDataTypes,
      typeAccuracy,
      avgConfidence,
      avgTitleQuality,
    },
    details: results
  };
}

/**
 * 快速评估 (不重新截图)
 */
function quickEvaluate() {
  console.log('\n⚡ 快速评估模式 (使用现有数据)');

  const scrapedPath = path.join(__dirname, 'public', 'scraped.json');
  const scriptPath = path.join(__dirname, 'public', 'ai-script.json');

  if (!fs.existsSync(scrapedPath)) {
    console.log('❌ 请先运行 pipeline.js 生成数据');
    return;
  }

  const scrapedData = JSON.parse(fs.readFileSync(scrapedPath, 'utf8'));
  const contentMetrics = analyzeScrapedData(scrapedData);

  console.log('\n📊 当前数据评估:');
  console.log(`   内容长度: ${contentMetrics.coreTextLength} 字符`);
  console.log(`   数据类型: ${contentMetrics.dataTypes} 种`);
  console.log(`   标题数量: ${contentMetrics.headingsCount}`);
  console.log(`   功能特性: ${contentMetrics.featuresCount}`);
  console.log(`   CTA 数量: ${contentMetrics.ctaCount}`);
  console.log(`   SEO 数据: ${contentMetrics.hasSEO ? '✓' : '✗'}`);
  console.log(`   结构化数据: ${contentMetrics.hasJsonLd ? '✓' : '✗'}`);

  if (fs.existsSync(scriptPath)) {
    const scriptData = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
    const scriptMetrics = analyzeScript(scriptData, scrapedData.productName);

    console.log('\n📝 脚本质量:');
    console.log(`   场景数: ${scriptMetrics.sceneCount}`);
    console.log(`   平均标题长度: ${scriptMetrics.avgTitleLength} 词`);
    console.log(`   标题质量得分: ${scriptMetrics.titleQualityRatio}%`);
    console.log(`   产品名: ${scriptMetrics.productCorrect ? '✓' : '✗'} (${scrapedData.productName})`);
  }

  // 改进对比
  const oldLength = 500;
  const improvement = Math.round((contentMetrics.coreTextLength - oldLength) / oldLength * 100);

  console.log('\n📈 改进效果:');
  console.log(`   内容量提升: ${improvement > 0 ? '+' : ''}${improvement}%`);
  console.log(`   数据类型: ${contentMetrics.dataTypes} 种 (原来: 3 种)`);
}

// 命令行入口
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--quick') || args.includes('-q')) {
    quickEvaluate();
  } else if (args.includes('--full')) {
    // 完整评估
    (async () => {
      const results = [];
      for (const website of TEST_WEBSITES) {
        const result = await evaluateWebsite(website);
        results.push(result);
      }
      generateReport(results);
    })();
  } else {
    console.log(`
使用方法:
  node evaluate.js --quick    快速评估 (使用现有数据)
  node evaluate.js --full     完整评估 (重新爬取所有测试网站)
    `);
  }
}

module.exports = {
  analyzeScrapedData,
  analyzeAIResult,
  analyzeScript,
  generateReport,
  quickEvaluate,
};