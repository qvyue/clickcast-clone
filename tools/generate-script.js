// generate-script.js - 使用 AI Agent 生成脚本
const fs = require('fs');
const path = require('path');

// 手动加载 .env 文件
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

async function generateScript() {
  console.log('\n🧠 [2/4] AI Agent 智能创作视频脚本...');

  const scrapedPath = path.join(__dirname, 'public', 'scraped.json');
  if (!fs.existsSync(scrapedPath)) {
    console.error('找不到 scraped.json，请先运行 capture.js');
    return;
  }

  let scrapedData = JSON.parse(fs.readFileSync(scrapedPath, 'utf8'));

  // 行业研究 (联网搜索)
  console.log('   🔍 进行行业研究...');
  const { enhanceWithIndustryResearch } = require('./industry-research.js');
  scrapedData = await enhanceWithIndustryResearch(scrapedData);

  // 使用 AI Agent 模块
  const { runAIAgent } = require('./ai-agent.js');

  const screenshots = [];
  for (let i = 1; i <= 6; i++) {
    if (fs.existsSync(path.join(__dirname, 'public', `shot${i}.png`))) {
      screenshots.push(`shot${i}.png`);
    }
  }

  const result = await runAIAgent(scrapedData, screenshots);

  if (!result?.script) {
    console.error('AI Agent 生成失败，使用基础生成');
    const { generateScript: basicGenerate } = require('./ai-analyze.js');
    const basicScript = await basicGenerate(scrapedData);
    if (basicScript) {
      saveScript(basicScript);
    }
    return;
  }

  saveScript(result.script);

  // 输出额外信息
  if (result.websiteType) {
    console.log(`\n📊 网站分析:`);
    console.log(`   类型: ${result.websiteType.type}`);
    console.log(`   风格: ${result.websiteType.suggestedStyle}`);
    console.log(`   受众: ${result.websiteType.targetAudience}`);
  }

  if (result.validation) {
    console.log(`\n🔍 质量评分: ${result.validation.score}/100`);
    if (result.validation.suggestions?.length > 0) {
      console.log(`   建议: ${result.validation.suggestions[0]}`);
    }
  }
}

function saveScript(script) {
  // 转换为 ai-script.json 格式
  const outputScript = {
    script: []
  };

  // Intro
  if (script.scenes?.[0]) {
    outputScript.script.push({
      id: 'intro',
      layout: 'center',
      title: script.scenes[0].title,
      subText: script.scenes[0].subText || '',
      text: `${script.product}. ${script.scenes[0].title}.`
    });
  }

  // Middle scenes
  const middleScenes = script.scenes?.slice(1) || [];
  middleScenes.forEach((scene, i) => {
    if (scene.id !== 'outro' && !scene.id?.includes('outro')) {
      outputScript.script.push({
        id: `scene${i}`,
        layout: i % 2 === 0 ? 'left' : 'center',
        title: scene.title,
        subText: scene.subText || '',
        img: scene.screenshot || `shot${i + 1}.png`,
        text: scene.voiceover || scene.title
      });
    }
  });

  // Outro
  outputScript.script.push({
    id: 'outro',
    layout: 'center',
    title: `Try ${script.product}`,
    subText: script.tagline || '',
    text: `${script.product}. ${script.tagline}.`
  });

  fs.writeFileSync(
    path.join(__dirname, 'public', 'ai-script.json'),
    JSON.stringify(outputScript, null, 2)
  );

  console.log('✅ AI Agent 创作完毕！视频脚本已保存');
}

generateScript();