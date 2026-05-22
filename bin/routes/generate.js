/**
 * 强制执行 timeline 数据规则
 * 在所有写入 timeline.json 之前调用，确保数据满足业务约束
 *
 * 规则：
 * - 非 intro/outro 场景的 subVoiceover 和 subTitle 必须有内容
 * - 旧格式字段（text/subText）映射到新格式（mainTitle/subVoiceover）
 */
function enforceTimelineRules(timeline) {
  if (!timeline || !timeline.scenes) return;

  const product = timeline.product || 'this product';

  for (const scene of timeline.scenes) {
    // 旧格式映射
    if (!scene.mainTitle) {
      if (scene.text) {
        scene.mainTitle = scene.text;
        delete scene.text;
      } else if (scene.title) {
        scene.mainTitle = scene.title;
      }
    }

    if (!scene.subTitle) {
      if (scene.subVoiceover) {
        scene.subTitle = scene.subVoiceover;
      } else if (scene.subText) {
        scene.subTitle = scene.subText;
        delete scene.subText;
      }
    }

    // 核心规则：title = mainTitle，subVoiceover = subTitle（文案 = 配音）
    scene.title = scene.mainTitle;
    scene.subVoiceover = scene.subTitle;

    // 清理旧字段
    delete scene.text;
    delete scene.subText;

    // 所有场景：填充空的 subTitle（不再拆分 mainTitle）
    if (!scene.subTitle || !scene.subTitle.trim()) {
      scene.subTitle = `Discover more about ${product}.`;
      scene.title = scene.mainTitle;
      scene.subVoiceover = scene.subTitle;
    }
  }
}

/**
 * Generate Routes
 * 自动化视频生成流程：截图 → AI 分析 → 配音 → 生成 timeline
 * 不包含最终渲染，让用户在编辑器中手动触发
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { jobs } = require('../utils/state');
const { extractDomainFromUrl } = require('../../utils/domain');

const router = express.Router();

console.log('[generate.js] Route module loaded');

// 加载环境变量
require('dotenv').config();

// 配置
const CONFIG = {
  API_KEY: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
  API_BASE_URL: process.env.API_BASE_URL || 'https://api.deepseek.com',
  AI_MODEL: process.env.AI_MODEL || 'deepseek-chat',
  VOICE: process.env.VOICE || 'en-US-ChristopherNeural',
};

/**
 * 构建简洁的 outro 文本（一句话，最多 15 词）
 */
function buildConciseOutro(product, tagline) {
  // 构造一句话："Try <Product> with <tagline>"
  // 如果 tagline 太长，截取可用词数
  const prefix = `Try ${product}`;
  const prefixWords = prefix.split(/\s+/).length;
  const availableWords = Math.max(0, 15 - prefixWords);

  // 取 tagline 的第一句（去掉末尾标点）
  let taglineText = (tagline || '').replace(/\.\.+$/, '').trim();
  const firstSentence = taglineText.match(/^[^.!?]+/);
  if (firstSentence) taglineText = firstSentence[0].trim();

  const taglineWords = taglineText.split(/\s+/).filter(w => w);
  const conciseTagline = taglineWords.slice(0, availableWords).join(' ');

  // 拼成一句话，用逗号连接
  let text;
  if (availableWords > 0 && conciseTagline) {
    text = `${prefix} — ${conciseTagline}.`;
  } else {
    text = `${prefix}.`;
  }

  return text;
}

/**
 * 从 cli.js 提取的核心流程函数
 */

// 步骤1: 截图
async function captureWebsite(url, outputDir, jobId) {
  jobs.set(jobId, { ...jobs.get(jobId), message: 'Capturing screenshots...', progress: 5 });

  return new Promise((resolve) => {
    // 使用绝对路径调用 capture.js
    const captureScript = path.resolve(__dirname, '../../lib/capture.js');
    const absoluteOutputDir = path.resolve(outputDir);

    console.log(`   [capture] Script: ${captureScript}`);
    console.log(`   [capture] URL: ${url}`);
    console.log(`   [capture] OutputDir: ${absoluteOutputDir}`);

    const proc = spawn('node', [captureScript, url, absoluteOutputDir], {
      cwd: path.resolve(__dirname, '../..'),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env }  // 继承当前进程的环境变量（包括代理设置）
    });

    let stdoutBuf = '';
    let stderrBuf = '';
    const MAX_BUF = 1024 * 50; // 保留尾部 50KB 用于错误识别

    proc.stdout.on('data', (chunk) => {
      const str = chunk.toString();
      process.stdout.write(str); // 实时透传到父进程日志
      stdoutBuf = (stdoutBuf + str).slice(-MAX_BUF);
    });
    proc.stderr.on('data', (chunk) => {
      const str = chunk.toString();
      process.stderr.write(str);
      stderrBuf = (stderrBuf + str).slice(-MAX_BUF);
    });

    proc.on('error', (err) => {
      console.error(`   [capture] Process error: ${err.message}`);
      resolve({ ok: false, reason: `Process error: ${err.message}` });
    });

    proc.on('close', (code) => {
      console.log(`   [capture] Process exited with code: ${code}`);
      const files = fs.existsSync(absoluteOutputDir) ? fs.readdirSync(absoluteOutputDir) : [];
      const hasScreenshots = files.some(f => f.match(/^shot\d+\.png$/));
      console.log(`   [capture] Files in output dir: ${files.slice(0, 10).join(', ')}`);
      console.log(`   [capture] Has screenshots: ${hasScreenshots}`);

      if (code === 0 && hasScreenshots) {
        return resolve({ ok: true, file: path.join(absoluteOutputDir, 'shot1.png') });
      }

      // 失败：识别常见网络错误，输出友好的提示
      const allLog = (stdoutBuf + '\n' + stderrBuf);
      let reason = `Screenshot capture failed (exit code: ${code})`;
      const netPatterns = [
        { pattern: /ERR_CONNECTION_RESET/i, hint: '目标网站连接被重置（可能是网络受限/被防火墙拦截）' },
        { pattern: /ERR_CONNECTION_REFUSED/i, hint: '目标网站拒绝连接（服务可能未启动）' },
        { pattern: /ERR_CONNECTION_TIMED_OUT|Timeout 60000ms exceeded/i, hint: '访问目标网站超时（网络不可达或网站响应过慢）' },
        { pattern: /ERR_NAME_NOT_RESOLVED|net::ERR_NAME_NOT_RESOLVED/i, hint: '无法解析域名（请检查 URL 拼写或 DNS）' },
        { pattern: /ERR_HTTP2_PROTOCOL_ERROR/i, hint: '目标网站 HTTP/2 协议错误（服务器端兼容性问题，请稍后重试）' },
        { pattern: /ERR_CERT_|ERR_SSL_/i, hint: '目标网站 SSL 证书有问题' },
        { pattern: /net::ERR_/i, hint: '网络层错误，无法访问目标网站' },
      ];

      for (const { pattern, hint } of netPatterns) {
        if (pattern.test(allLog)) {
          reason = `无法访问目标网站：${hint}。请检查 URL 是否正确或网络是否可访问该域名。`;
          console.error(`   [capture] 🌐 网络错误识别: ${hint}`);
          break;
        }
      }

      resolve({ ok: false, reason });
    });
  });
}

// 步骤2: AI 分析
async function analyzeWithAI(scrapedPath, outputDir, jobId) {
  jobs.set(jobId, { ...jobs.get(jobId), message: 'AI analyzing...', progress: 25 });

  let scrapedData = { title: '', description: '', core_text: '' };
  if (fs.existsSync(scrapedPath)) {
    try {
      scrapedData = JSON.parse(fs.readFileSync(scrapedPath, 'utf-8'));
    } catch (e) {
      console.log(`   ⚠️ 读取 scraped.json 失败: ${e.message}`);
    }
  }

  // 行业研究
  try {
    const { enhanceWithIndustryResearch } = require('../../lib/industry-research.js');
    scrapedData = await enhanceWithIndustryResearch(scrapedData, scrapedPath);
  } catch (e) {
    console.log(`   ⚠️ 行业研究失败: ${e.message}`);
  }

  // AI Agent
  const { runAIAgent } = require('../../lib/ai-agent.js');
  const result = await runAIAgent(scrapedData, [
    'shot1.png', 'shot2.png', 'shot3.png', 'shot4.png', 'shot5.png', 'shot6.png'
  ]);

  return {
    script: result?.script || generateDefaultScript(),
    style: result?.style || null
  };
}

// 默认脚本
function generateDefaultScript() {
  return {
    product: "Your Product",
    tagline: "Amazing Solution",
    scenes: [
      { title: "Welcome", subTitle: "Discover the future" },
      { title: "Powerful Features", subTitle: "Built for you" },
      { title: "Easy to Use", subTitle: "Intuitive design" },
      { title: "Trusted by Millions", subTitle: "Join our community" },
      { title: "Get Started", subTitle: "Try it free" }
    ]
  };
}

// 步骤3: 生成配音 (ElevenLabs)
async function generateVoiceovers(scenes, outputDir, jobId) {
  jobs.set(jobId, { ...jobs.get(jobId), message: 'Generating voiceovers...', progress: 50 });

  const elevenlabsTts = require('../../lib/elevenlabs-tts.js');
  const { getAudioDuration } = require('../utils/audio');

  if (!elevenlabsTts.isElevenLabsConfigured()) {
    throw new Error('ElevenLabs API Key not configured. Please set ELEVENLABS_API_KEY in .env');
  }

  const audioDurations = [];
  const voiceName = process.env.ELEVENLABS_VOICE || 'Dallin';

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    const progress = 50 + Math.round((i / scenes.length) * 30);
    jobs.set(jobId, { ...jobs.get(jobId), message: `Generating voiceover ${i + 1}/${scenes.length}...`, progress });

    const mainText = scene.mainTitle || '';
    const subText = scene.subTitle || '';

    // 所有场景统一处理：分别生成 main 和 sub 音频
    let mainDuration = 0;
    let subDuration = 0;

    if (mainText && mainText.trim()) {
      const mainFile = `${scene.id}-main.mp3`;
      const mainPath = path.join(outputDir, mainFile);
      const success = await elevenlabsTts.generateSpeech(mainText, mainPath, voiceName);
      mainDuration = success ? getAudioDuration(mainPath) : 3;
    }

    if (subText && subText.trim()) {
      const subFile = `${scene.id}-sub.mp3`;
      const subPath = path.join(outputDir, subFile);
      const success = await elevenlabsTts.generateSpeech(subText, subPath, voiceName);
      subDuration = success ? getAudioDuration(subPath) : 3;
    }

    audioDurations.push({
      id: scene.id,
      mainDuration,
      subDuration
    });
  }

  return audioDurations;
}

// 步骤4: 生成 timeline
async function generateTimeline(script, audioDurations, outputDir, style, jobId, voiceoverScenes) {
  jobs.set(jobId, { ...jobs.get(jobId), message: 'Generating timeline...', progress: 85 });

  const FPS = 30;
  const timeline = {
    product: script.product,
    tagline: script.tagline,
    fps: FPS,
    totalFrames: 0,
    scenes: [],
    style: style
  };

  // 读取 scraped.json 获取截图尺寸信息
  const scrapedPath = path.join(outputDir, 'scraped.json');
  let screenshotSizes = {};
  if (fs.existsSync(scrapedPath)) {
    try {
      const scraped = JSON.parse(fs.readFileSync(scrapedPath, 'utf8'));
      (scraped.screenshots || []).forEach(s => {
        screenshotSizes[s.file] = { width: s.width, height: s.height };
      });
      console.log(`   📸 截图尺寸信息已加载: ${Object.keys(screenshotSizes).length} 张`);
    } catch (e) {
      console.log(`   ⚠️ 读取截图尺寸失败: ${e.message}`);
    }
  }

  let currentStartFrame = 0;

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const audioInfo = audioDurations[i] || { mainDuration: 3, subDuration: 0 };
    const transitionDuration = 0.5;
    const totalAudioDuration = audioInfo.mainDuration + transitionDuration + audioInfo.subDuration;
    const sceneDurationFrames = Math.ceil((totalAudioDuration + 0.5) * FPS);

    const isIntro = i === 0;

    // 从 voiceoverScenes 读取文本（与配音同源，确保字幕=配音）
    const vs = voiceoverScenes[i] || {};
    const mainTitleText = vs.mainTitle || scene.mainTitle || '';
    const subTitleText = vs.subTitle || scene.subTitle || '';

    // 主文案=主配音，副文案=副配音，始终一致
    const subVoiceoverText = subTitleText;

    const shotFile = `shot${i + 1}.png`;
    const shotInfo = screenshotSizes[shotFile] || {};
    const isLongImage = shotInfo.height && shotInfo.width && (shotInfo.height / shotInfo.width > 1.2);
    if (isLongImage) {
      console.log(`   📜 检测到长图: ${shotFile} (${shotInfo.width}x${shotInfo.height})`);
    }

    const hasSubVoiceover = subVoiceoverText && subVoiceoverText.trim();
    const sceneId = isIntro ? 'intro' : `scene${i - 1}`;

    timeline.scenes.push({
      id: sceneId,
      layout: i % 2 === 0 ? 'left' : 'center',
      title: mainTitleText,
      mainTitle: mainTitleText,
      subTitle: subTitleText,
      subVoiceover: subTitleText,
      img: shotFile,
      scrollImage: isLongImage,
      imageWidth: shotInfo.width,
      imageHeight: shotInfo.height,
      audioFile: `${sceneId}-main.mp3`,
      audioFileSub: hasSubVoiceover ? `${sceneId}-sub.mp3` : undefined,
      mainDuration: audioInfo.mainDuration,
      subDuration: hasSubVoiceover ? audioInfo.subDuration : 0,
      transitionDuration: hasSubVoiceover && audioInfo.subDuration > 0 ? transitionDuration : undefined,
      voiceoverSource: 'elevenlabs',
      subVoiceoverSource: hasSubVoiceover && audioInfo.subDuration > 0 ? 'elevenlabs' : undefined,
      startFrame: currentStartFrame,
      durationInFrames: sceneDurationFrames,
      audioStartFrame: 10
    });

    currentStartFrame += sceneDurationFrames;
  }

  // outro — 从 voiceoverScenes 获取 mainTitle/subTitle（与配音同源）
  const outroAudioInfo = audioDurations[audioDurations.length - 1] || { mainDuration: 3, subDuration: 0 };
  const outroVoiceoverScene = (voiceoverScenes || []).find(vs => vs.id === 'outro') || {};
  const outroMainTitle = outroVoiceoverScene.mainTitle || buildConciseOutro(script.product, script.tagline);
  const outroSubTitle = outroVoiceoverScene.subTitle || '';
  const outroHasSub = outroSubTitle && outroSubTitle.trim();
  const outroTransitionDur = 0.5;
  const outroTotalDuration = outroAudioInfo.mainDuration + (outroHasSub ? outroTransitionDur + outroAudioInfo.subDuration : 0);
  const outroDurationFrames = Math.ceil((outroTotalDuration + 0.5) * FPS);

  timeline.scenes.push({
    id: 'outro',
    layout: 'center',
    title: outroMainTitle,
    mainTitle: outroMainTitle,
    subTitle: outroSubTitle,
    subVoiceover: outroSubTitle,
    audioFile: 'outro-main.mp3',
    audioFileSub: outroHasSub ? 'outro-sub.mp3' : undefined,
    mainDuration: outroAudioInfo.mainDuration,
    subDuration: outroHasSub ? outroAudioInfo.subDuration : 0,
    transitionDuration: outroHasSub && outroAudioInfo.subDuration > 0 ? outroTransitionDur : undefined,
    voiceoverSource: 'elevenlabs',
    subVoiceoverSource: outroHasSub && outroAudioInfo.subDuration > 0 ? 'elevenlabs' : undefined,
    startFrame: currentStartFrame,
    durationInFrames: outroDurationFrames,
    audioStartFrame: 10
  });

  currentStartFrame += outroDurationFrames;
  timeline.totalFrames = currentStartFrame + 30;

  // 验证截图文件是否存在，如果缺失则使用已存在的截图
  const availableShots = [];
  let lastAvailableShot = 'shot1.png';

  // 扫描所有可用的截图
  for (let i = 1; i <= 20; i++) {
    const shotFile = `shot${i}.png`;
    if (fs.existsSync(path.join(outputDir, shotFile))) {
      availableShots.push(shotFile);
      lastAvailableShot = shotFile;
    }
  }

  console.log(`   📸 可用截图: ${availableShots.join(', ')}`);

  // 检查并修复缺失的截图
  for (const scene of timeline.scenes) {
    if (scene.img && !fs.existsSync(path.join(outputDir, scene.img))) {
      console.log(`   ⚠️ 截图缺失: ${scene.img}，使用 ${lastAvailableShot} 替代`);
      scene.img = lastAvailableShot;
    }

    if (scene.audioFile && !fs.existsSync(path.join(outputDir, scene.audioFile))) {
      console.log(`   ⚠️ 音频缺失: ${scene.audioFile}`);
    }

    if (scene.audioFileSub && !fs.existsSync(path.join(outputDir, scene.audioFileSub))) {
      console.log(`   ⚠️ 次配音缺失: ${scene.audioFileSub}`);
    }
  }

  // 保存前强制执行数据规则
  enforceTimelineRules(timeline);

  // 保存
  const timelinePath = path.join(outputDir, 'timeline.json');
  fs.writeFileSync(timelinePath, JSON.stringify(timeline, null, 2));

  return timeline;
}

/**
 * 异步执行完整生成流程
 */
async function generateAsync(jobId, url, aspectRatio) {
  const job = jobs.get(jobId);

  try {
    // 自动补全 URL 协议前缀
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    console.log(`[${jobId}] Normalized URL: ${url} -> ${normalizedUrl}`);

    // 提取域名
    const domain = extractDomainFromUrl(normalizedUrl);
    const websiteDir = path.join(__dirname, '../../websites', domain);
    const outputDir = path.join(websiteDir, 'public');

    // 确保目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 更新 job 状态
    jobs.set(jobId, { ...job, domain, status: 'processing', message: 'Starting...', progress: 2 });

    // 步骤1: 截图
    const screenshotResult = await captureWebsite(normalizedUrl, outputDir, jobId);
    if (!screenshotResult || !screenshotResult.ok) {
      const reason = (screenshotResult && screenshotResult.reason) || 'Screenshot capture failed';
      console.error(`[${jobId}] ❌ 截图失败: ${reason}`);
      throw new Error(reason);
    }

    // 步骤2: AI 分析
    const scrapedPath = path.join(outputDir, 'scraped.json');
    const aiResult = fs.existsSync(scrapedPath)
      ? await analyzeWithAI(scrapedPath, outputDir, jobId)
      : { script: generateDefaultScript(), style: null };

    const script = aiResult?.script || generateDefaultScript();
    const style = aiResult?.style;

    // 准备配音场景列表
    const voiceoverScenes = [];
    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];
      // 主文案 = 主配音，副文案 = 副配音，始终一致
      const mainText = scene.mainTitle || '';
      const subText = scene.subTitle || '';

      let introMainTitle = mainText;
      if (i === 0) {
        const withProduct = `${script.product}. ${mainText}`;
        introMainTitle = withProduct.split(/\s+/).length <= 15 ? withProduct : mainText;
      }

      voiceoverScenes.push({
        id: i === 0 ? 'intro' : `scene${i - 1}`,
        mainTitle: introMainTitle,
        subTitle: subText
      });
    }
    // outro 的 subTitle 从 AI 脚本中最后一个场景读取（如果存在且非空）
    // 否则使用默认值，确保 TTS 会生成对应的配音音频
    const outroScene = script.scenes[script.scenes.length - 1];
    const outroSubFromScript = (outroScene && outroScene.id === 'outro' && outroScene.subTitle && outroScene.subTitle.trim())
      ? outroScene.subTitle
      : `Get started with ${script.product || 'this product'} today.`;

    voiceoverScenes.push({
      id: 'outro',
      mainTitle: buildConciseOutro(script.product, script.tagline),
      subTitle: outroSubFromScript
    });

    // 步骤3: 生成配音
    const audioDurations = await generateVoiceovers(voiceoverScenes, outputDir, jobId);

    // 步骤4: 生成 timeline
    await generateTimeline(script, audioDurations, outputDir, style, jobId, voiceoverScenes);

    // 完成
    jobs.set(jobId, {
      ...jobs.get(jobId),
      status: 'completed',
      progress: 100,
      message: 'Ready for rendering',
      domain,
      aspectRatio
    });

    console.log(`[${jobId}] Generation completed: ${domain}`);

  } catch (error) {
    console.error(`[${jobId}] Generation failed:`, error.message);
    jobs.set(jobId, {
      ...jobs.get(jobId),
      status: 'failed',
      message: error.message || 'Generation failed'
    });
  }
}

/**
 * POST /api/generate
 * 启动自动生成流程
 */
router.post('/', async (req, res) => {
  console.log('[generate.js] POST /api/generate received');
  const { url, aspectRatio = 'landscape' } = req.body;

  // 验证 URL
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // 生成 job ID
  const jobId = `generate-${Date.now()}`;

  // 初始化 job 状态
  jobs.set(jobId, {
    status: 'pending',
    progress: 0,
    message: 'Preparing...',
    aspectRatio,
    createdAt: Date.now()
  });

  // 异步执行生成流程
  generateAsync(jobId, url, aspectRatio);

  // 立即返回 job ID
  // 自动补全协议前缀以正确提取域名
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }
  const domain = extractDomainFromUrl(normalizedUrl);
  res.json({ jobId, domain });
});

module.exports = router;
