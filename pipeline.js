/**
 * ClickCast AI Video Pipeline
 *
 * 完整流程：输入URL -> 截图 -> AI分析 -> 生成文案 -> 配音 -> 渲染视频
 *
 * 使用方法：
 *   node pipeline.js "https://example.com" [landscape|portrait]
 */

const { execSync, spawn } = require('child_process');
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

// ==========================================
// 配置区
// ==========================================
const CONFIG = {
  API_KEY: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
  API_BASE_URL: process.env.API_BASE_URL || 'https://api.deepseek.com',
  AI_MODEL: process.env.AI_MODEL || 'deepseek-chat',
  VOICE: process.env.VOICE || 'en-US-ChristopherNeural',
  BGM_VOLUME: parseFloat(process.env.BGM_VOLUME) || 0.15,
  MAX_SCENES: 6,
};

// ==========================================
// 辅助函数: 从 URL 提取域名
// ==========================================
function extractDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    // 移除 www. 前缀，获取干净的域名
    return urlObj.hostname.replace(/^www\./, '');
  } catch (e) {
    // 如果 URL 解析失败，使用时间戳
    return `unknown-${Date.now()}`;
  }
}

// ==========================================
// 步骤1: 截图 (调用 capture.js 完整流程)
// ==========================================
async function captureWebsite(url, outputDir = './public') {
  console.log('\n[1/5] 📸 截图网站...');

  return new Promise((resolve) => {
    const proc = spawn('node', ['capture.js', url, outputDir], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    proc.on('close', (code) => {
      if (code === 0) {
        console.log('✅ 截图完成');
        resolve(path.join(outputDir, 'website-shot.png'));
      } else {
        console.log('⚠️ 截图流程出错');
        resolve(null);
      }
    });
  });
}

// ==========================================
// 步骤2: AI 分析 (使用 AI Agent + 行业研究)
// ==========================================
async function analyzeImageWithAI(scrapedPath, outputDir) {
  console.log('\n[2/5] AI Agent 智能分析...');

  // 读取抓取的文字内容
  let scrapedData = { title: '', description: '', core_text: '' };
  if (fs.existsSync(scrapedPath)) {
    try {
      scrapedData = JSON.parse(fs.readFileSync(scrapedPath, 'utf-8'));
    } catch (e) {}
  }

  // 行业研究 (联网搜索行业信息)
  console.log('   🔍 进行行业研究...');
  const { enhanceWithIndustryResearch } = require('./industry-research.js');
  scrapedData = await enhanceWithIndustryResearch(scrapedData);

  // 使用 AI Agent 模块
  const { runAIAgent } = require('./ai-agent.js');
  const result = await runAIAgent(scrapedData, [
    'shot1.png', 'shot2.png', 'shot3.png', 'shot4.png', 'shot5.png', 'shot6.png'
  ]);

  return {
    script: result?.script || generateDefaultScript(),
    style: result?.style || null
  };
}

// ==========================================
// 辅助函数: 获取音频时长
// ==========================================
function getAudioDuration(filePath) {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return parseFloat(result.trim());
  } catch (e) {
    console.log(`   ⚠️ 无法读取音频时长: ${e.message}`);
    return 3; // 默认3秒
  }
}

// ==========================================
// 默认脚本
// ==========================================
function generateDefaultScript() {
  return {
    product: "Your Product",
    tagline: "Amazing Solution",
    scenes: [
      { title: "Welcome", subText: "Discover the future" },
      { title: "Powerful Features", subText: "Built for you" },
      { title: "Easy to Use", subText: "Intuitive design" },
      { title: "Trusted by Millions", subText: "Join our community" },
      { title: "Get Started", subText: "Try it free" }
    ]
  };
}

// ==========================================
// 步骤4: 生成时间轴 (根据配音时长动态计算)
// ==========================================
async function generateTimeline(script, audioDurations, outputDir = './public', style = null, cropStrategies = []) {
  console.log('\n[4/5] ⏱️ 生成视频时间轴...');

  // 创建裁切策略映射 (文件名 -> 策略)
  const cropMap = {};
  cropStrategies.forEach(c => {
    cropMap[c.file] = c;
  });

  const timeline = {
    product: script.product,
    tagline: script.tagline,
    fps: 30,
    totalFrames: 0,
    scenes: [],
    style: style // 添加 AI 生成的视频风格
  };

  const FPS = 30;
  let currentStartFrame = 0;

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const screenshotFile = scene.screenshot || `shot${i + 1}.png`;

    // 获取该截图的裁切策略
    const cropInfo = cropMap[screenshotFile] || {
      fitMode: 'contain',
      focusArea: 'center',
      safeZone: 100
    };

    // 根据配音时长计算场景时长
    const audioDuration = audioDurations[i] || 3;
    const sceneDurationFrames = Math.ceil((audioDuration + 0.5) * FPS); // 加0.5秒缓冲

    timeline.scenes.push({
      id: i === 0 ? 'intro' : `scene${i - 1}`,
      layout: i % 2 === 0 ? 'left' : 'center',
      title: scene.title,
      subText: scene.subText,
      img: screenshotFile,
      text: i === 0 ? `${script.product}. ${scene.title}.` : scene.title,
      audioFile: i === 0 ? 'intro.mp3' : `scene${i - 1}.mp3`,
      startFrame: currentStartFrame,
      durationInFrames: sceneDurationFrames,
      audioStartFrame: 10,
      // 新增：智能裁切配置
      imageFit: cropInfo.fitMode,
      imageFocus: cropInfo.focusArea,
      imageSafeZone: cropInfo.safeZone
    });

    currentStartFrame += sceneDurationFrames;
  }

  // outro - 使用最后一个音频时长
  const outroAudioDuration = audioDurations[audioDurations.length - 1] || 3;
  const outroDurationFrames = Math.ceil((outroAudioDuration + 1) * FPS);

  timeline.scenes.push({
    id: 'outro',
    layout: 'center',
    title: `Try ${script.product}`,
    subText: script.tagline,
    text: `${script.product}. ${script.tagline}.`,
    audioFile: 'outro.mp3',
    startFrame: currentStartFrame,
    durationInFrames: outroDurationFrames,
    audioStartFrame: 10
  });

  currentStartFrame += outroDurationFrames;
  timeline.totalFrames = currentStartFrame + 30;

  const timelinePath = path.join(outputDir, 'timeline.json');
  fs.writeFileSync(timelinePath, JSON.stringify(timeline, null, 2));
  console.log('✅ 时间轴已保存');

  return timeline;
}

// ==========================================
// 步骤3: 生成配音 (返回音频时长数组)
// ==========================================
async function generateVoiceovers(scenes, outputDir = './public') {
  console.log('\n[3/5] 🎤 生成 AI 配音...');

  const audioDurations = [];

  for (const scene of scenes) {
    const audioFileName = `${scene.id}.mp3`;
    const outputPath = path.join(outputDir, audioFileName);

    console.log(`   🎙️ ${scene.id}`);

    try {
      const text = scene.text.replace(/"/g, '\\"');
      execSync(`python -m edge_tts --voice ${CONFIG.VOICE} --text "${text}" --write-media "${outputPath}"`, {
        stdio: 'pipe'
      });

      // 读取音频时长
      const duration = getAudioDuration(outputPath);
      audioDurations.push(duration);
      console.log(`   ⏱️ 时长: ${duration.toFixed(2)}秒`);
    } catch (e) {
      console.log(`   ⚠️ 配音失败: ${e.message}`);
      audioDurations.push(3); // 默认3秒
    }
  }

  console.log('✅ 配音生成完成');
  return audioDurations;
}

// ==========================================
// 步骤5: 渲染视频
// ==========================================
async function renderVideo(aspectRatio, outDir, publicDir) {
  console.log('\n[5/5] 渲染视频...');

  const compositionId = aspectRatio === 'portrait'
    ? 'ClickCastPromo-Portrait'
    : 'ClickCastPromo-Landscape';
  const outputFile = aspectRatio === 'portrait' ? 'portrait.mp4' : 'landscape.mp4';
  const outputPath = path.join(outDir, outputFile);

  // 确保输出目录存在
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 将当前网站的 public 目录复制到根目录的 public（Remotion 需要）
  const rootPublicDir = path.join(__dirname, 'public');

  // 保存根目录的 BGM 文件（这些文件需要保留）
  const bgmFiles = ['bensound-slowlife.mp3', 'bgm-tech-01.mp3'];
  const savedBgm = {};
  for (const bgm of bgmFiles) {
    const bgmPath = path.join(rootPublicDir, bgm);
    if (fs.existsSync(bgmPath)) {
      savedBgm[bgm] = fs.readFileSync(bgmPath);
    }
  }

  // 备份并替换 public 目录
  const backupDir = path.join(__dirname, 'public_backup');
  if (fs.existsSync(rootPublicDir)) {
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true });
    }
    fs.renameSync(rootPublicDir, backupDir);
  }

  // 复制网站专属 public 到根目录
  fs.cpSync(publicDir, rootPublicDir, { recursive: true });

  // 恢复 BGM 文件
  for (const [bgm, content] of Object.entries(savedBgm)) {
    const bgmPath = path.join(rootPublicDir, bgm);
    fs.writeFileSync(bgmPath, content);
  }

  // 查找 Playwright Chromium 路径
  let chromiumPath = null;
  const playwrightPath = '/root/.cache/ms-playwright';
  if (fs.existsSync(playwrightPath)) {
    const chromiumDirs = fs.readdirSync(playwrightPath).filter(d => d.startsWith('chromium'));
    if (chromiumDirs.length > 0) {
      const chromePath = path.join(playwrightPath, chromiumDirs[0], 'chrome-linux', 'chrome');
      if (fs.existsSync(chromePath)) {
        chromiumPath = chromePath;
        console.log(`   使用 Chromium: ${chromePath}`);
      }
    }
  }

  // 构建 Remotion 渲染命令 - 添加内存优化参数
  let renderCmd = `npx remotion render ${compositionId} "${outputPath}"`;

  // 添加 Chromium 路径
  if (chromiumPath) {
    renderCmd += ` --chromium-executable-path="${chromiumPath}"`;
  }

  // 内存优化: 降低并发
  renderCmd += ' --concurrency=1';

  console.log(`   渲染命令: ${renderCmd}`);

  try {
    execSync(renderCmd, {
      cwd: __dirname,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=512'
      }
    });
    console.log(`视频渲染完成: ${outputFile}`);

    // 清理并恢复原始 public 目录
    fs.rmSync(rootPublicDir, { recursive: true });
    if (fs.existsSync(backupDir)) {
      fs.renameSync(backupDir, rootPublicDir);
    }

    return outputPath;
  } catch (e) {
    console.error(`渲染失败: ${e.message}`);

    // 恢复原始 public 目录
    try {
      fs.rmSync(rootPublicDir, { recursive: true });
      if (fs.existsSync(backupDir)) {
        fs.renameSync(backupDir, rootPublicDir);
      }
    } catch (cleanupError) {
      // 忽略清理错误
    }

    return null;
  }
}

// ==========================================
// 主流程
// ==========================================
async function main() {
  console.log('==========================================');
  console.log('   ClickCast AI Video Pipeline');
  console.log('   URL -> 截图 -> AI分析 -> 配音 -> 视频');
  console.log('==========================================');

  const url = process.argv[2];
  const aspectRatio = process.argv[3] || 'landscape';

  if (!url) {
    console.log('\n使用方法: node pipeline.js "https://example.com" [landscape|portrait]');
    return;
  }

  console.log(`视频比例: ${aspectRatio === 'portrait' ? '竖屏 9:16' : '横屏 16:9'}`);

  // 从 URL 提取域名，创建网站专属目录
  const domain = extractDomainFromUrl(url);
  const websiteDir = path.join(__dirname, 'websites', domain);
  const outputDir = path.join(websiteDir, 'public');
  const outDir = path.join(websiteDir, 'out');

  // 确保目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`📁 网站目录: websites/${domain}/`);

  try {
    // 检查是否已有 style（避免重复生成导致颜色不一致）
    const existingTimelinePath = path.join(outputDir, 'timeline.json');
    let existingStyle = null;

    if (fs.existsSync(existingTimelinePath)) {
      const existingTimeline = JSON.parse(fs.readFileSync(existingTimelinePath, 'utf-8'));
      if (existingTimeline.style) {
        existingStyle = existingTimeline.style;
        console.log('   ♻️ 复用已有的视频风格（保证横竖屏颜色一致）');
      }
    }

    // 1. 截图
    await captureWebsite(url, outputDir);

    // 2. AI 分析
    const scrapedPath = path.join(outputDir, 'scraped.json');
    const aiResult = fs.existsSync(scrapedPath)
      ? await analyzeImageWithAI(scrapedPath, outputDir)
      : { script: generateDefaultScript(), style: null };

    const script = aiResult.script;
    // 如果已有 style，复用它保证一致性；否则使用新生成的 style
    const videoStyle = existingStyle || aiResult.style;

    // 2.5 AI 智能分析图片裁切策略
    console.log('\n[2.5/5] 🖼️ AI 分析图片裁切策略...');
    const { analyzeImageCropStrategy } = require('./ai-agent.js');
    let scrapedData = null;
    if (fs.existsSync(scrapedPath)) {
      scrapedData = JSON.parse(fs.readFileSync(scrapedPath, 'utf-8'));
    }
    const cropStrategies = scrapedData?.screenshots
      ? await analyzeImageCropStrategy(scrapedData.screenshots)
      : [];
    console.log(`   ✅ 已分析 ${cropStrategies.length} 张截图的裁切策略`);

    // 3. 准备配音场景列表
    const voiceoverScenes = [];

    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];
      // 短视频风格: 只读 title
      const text = i === 0
        ? `${script.product}. ${scene.title}.`
        : scene.title;

      voiceoverScenes.push({
        id: i === 0 ? 'intro' : `scene${i - 1}`,
        text: text
      });
    }

    // 添加 outro
    voiceoverScenes.push({
      id: 'outro',
      text: `${script.product}. ${script.tagline}.`
    });

    // 生成配音并获取时长
    const audioDurations = await generateVoiceovers(voiceoverScenes, outputDir);

    // 4. 生成时间轴 (根据音频时长 + AI 风格 + 裁切策略)
    const timeline = await generateTimeline(script, audioDurations, outputDir, videoStyle, cropStrategies);

    // 4.5 AI 选择背景音乐
    console.log('\n[4.5/5] 🎵 AI 选择背景音乐...');
    const { selectBGMForVideo, generateBGMConfig } = require('./bgm-selector.js');

    // 读取 scrapedData 用于 AI 选择 BGM (复用之前定义的 scrapedPath)
    let scrapedDataForBGM = null;
    if (fs.existsSync(scrapedPath)) {
      scrapedDataForBGM = JSON.parse(fs.readFileSync(scrapedPath, 'utf-8'));
    }

    const bgmInfo = await selectBGMForVideo(
      script.websiteType || 'SAAS',
      timeline.totalFrames,
      scrapedDataForBGM
    );

    // 更新 timeline.json 添加 BGM 配置
    const timelinePath = path.join(outputDir, 'timeline.json');
    const timelineData = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
    timelineData.bgm = generateBGMConfig(bgmInfo, timelineData.totalFrames);
    fs.writeFileSync(timelinePath, JSON.stringify(timelineData, null, 2));
    console.log(`   ✅ BGM: ${bgmInfo.track.name} (${bgmInfo.style})`);

    // 5. 渲染视频
    const videoPath = await renderVideo(aspectRatio, outDir, outputDir);

    // 6. 上传到 R2 (如果配置了)
    let r2Url = null;
    if (videoPath) {
      const { isR2Configured, uploadVideo } = require('./r2-storage.js');
      if (isR2Configured()) {
        console.log('\n[6/6] ☁️ 上传到 R2...');
        const domain = extractDomainFromUrl(url);
        const videoFile = aspectRatio === 'portrait' ? 'portrait.mp4' : 'landscape.mp4';
        const r2Key = `videos/${domain}/${videoFile}`;
        const result = await uploadVideo(videoPath, r2Key);
        if (result.success) {
          r2Url = result.url;

          // 向 server.js 注册 R2 URL (如果是通过 server 启动的)
          if (process.env.RAILWAY_ENVIRONMENT || process.env.PORT) {
            try {
              const http = require('http');
              const registerUrl = `http://localhost:${process.env.PORT || 3000}/api/r2-register`;
              const postData = JSON.stringify({ key: r2Key, url: r2Url });

              const req = http.request(registerUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(postData)
                }
              });
              req.write(postData);
              req.end();
            } catch (e) {
              // 忽略注册错误
            }
          }
        }
      }
    }

    console.log('\n==========================================');
    if (videoPath) {
      console.log('全部完成! 视频已保存:');
      console.log(`   本地: ${videoPath}`);
      if (r2Url) {
        console.log(`   R2: ${r2Url}`);
      }
    } else {
      console.log('渲染失败，请检查错误信息');
    }
    console.log('==========================================');

  } catch (error) {
    console.error('流程出错:', error.message);
  }
}

main();
