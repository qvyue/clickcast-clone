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

// 全局错误处理
process.on('uncaughtException', (error) => {
  console.error('\n❌ 未捕获的异常:');
  console.error('   消息:', error.message);
  console.error('   文件:', error.stack?.split('\n')[1]?.trim() || '未知');
  console.error('   完整堆栈:\n', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ 未处理的 Promise 拒绝:');
  console.error('   原因:', reason?.message || reason);
  console.error('   堆栈:', reason?.stack || '未知');
  process.exit(1);
});

console.log('🚀 Pipeline v2024.03.24-4 启动...');

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
  // TTS 服务选择: 'edge-tts' (免费) 或 'elevenlabs' (高质量)
  TTS_SERVICE: process.env.TTS_SERVICE || 'elevenlabs',
  // ElevenLabs 声音: Dallin, Adam, Rachel, Antoni, Josh, Bella
  ELEVENLABS_VOICE: process.env.ELEVENLABS_VOICE || 'Dallin',
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
  console.log(`   📂 scrapedPath: ${scrapedPath}`);
  console.log(`   📂 outputDir: ${outputDir}`);
  console.log(`   📄 文件存在: ${fs.existsSync(scrapedPath)}`);

  // 读取抓取的文字内容
  let scrapedData = { title: '', description: '', core_text: '' };
  if (fs.existsSync(scrapedPath)) {
    try {
      console.log('   📖 读取 scraped.json...');
      scrapedData = JSON.parse(fs.readFileSync(scrapedPath, 'utf-8'));
      console.log('   ✅ scraped.json 读取成功');
    } catch (e) {
      console.log(`   ⚠️ 读取失败: ${e.message}`);
    }
  } else {
    console.log('   ⚠️ scraped.json 不存在，使用默认数据');
  }

  // 行业研究 (联网搜索行业信息)
  console.log('   🔍 进行行业研究...');
  console.log('   📞 即将加载 industry-research.js...');
  const { enhanceWithIndustryResearch } = require('./industry-research.js');
  console.log('   ✅ industry-research.js 加载成功');
  console.log('   📞 调用 enhanceWithIndustryResearch, savePath=' + scrapedPath);
  try {
    scrapedData = await enhanceWithIndustryResearch(scrapedData, scrapedPath);
    console.log('   ✅ 行业研究完成');
  } catch (e) {
    console.log(`   ❌ 行业研究失败: ${e.message}`);
    console.log(`   堆栈: ${e.stack}`);
    throw e;
  }

  // 使用 AI Agent 模块
  console.log('   🤖 即将加载 ai-agent.js...');
  const { runAIAgent } = require('./ai-agent.js');
  console.log('   ✅ ai-agent.js 加载成功');
  console.log('   📞 调用 runAIAgent...');
  const result = await runAIAgent(scrapedData, [
    'shot1.png', 'shot2.png', 'shot3.png', 'shot4.png', 'shot5.png', 'shot6.png'
  ]);
  console.log('   ✅ AI Agent 完成');

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
async function generateTimeline(script, audioDurations, outputDir = './public', style = null, cropStrategies = [], availableScreenshots = []) {
  console.log('\n[4/5] ⏱️ 生成视频时间轴...');

  // 创建裁切策略映射 (文件名 -> 策略)
  const cropMap = {};
  cropStrategies.forEach(c => {
    cropMap[c.file] = c;
  });

  // 验证可用截图
  const validScreenshots = availableScreenshots.filter(f => {
    const filePath = path.join(outputDir, f);
    return fs.existsSync(filePath);
  });
  console.log(`   📸 有效截图: ${validScreenshots.join(', ') || '无'}`);

  // 如果没有有效截图，生成默认截图文件名
  const fallbackScreenshots = validScreenshots.length > 0 ? validScreenshots : ['shot1.png'];

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
  let usedScreenshots = new Set(); // 追踪已使用的截图

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    let screenshotFile = scene.screenshot || `shot${i + 1}.png`;

    // 验证截图是否存在，如果不存在则使用可用截图
    if (!validScreenshots.includes(screenshotFile)) {
      // 找一个未使用的截图
      const unusedScreenshot = fallbackScreenshots.find(s => !usedScreenshots.has(s));
      if (unusedScreenshot) {
        console.log(`   ⚠️ ${screenshotFile} 不存在，使用 ${unusedScreenshot}`);
        screenshotFile = unusedScreenshot;
      } else {
        // 所有截图都用过了，循环使用
        screenshotFile = fallbackScreenshots[i % fallbackScreenshots.length];
        console.log(`   ⚠️ ${scene.screenshot || `shot${i + 1}.png`} 不存在，复用 ${screenshotFile}`);
      }
    }

    usedScreenshots.add(screenshotFile);

    // 获取该截图的裁切策略
    const cropInfo = cropMap[screenshotFile] || {
      fitMode: 'contain',
      focusArea: 'center',
      safeZone: 100
    };

    // AI 智能布局决策（从 AI 生成的 script 中获取）
    // 如果 AI 没有返回，使用智能默认值
    const titleLength = (scene.title || '').length;
    const subTextLength = (scene.subText || '').length;
    const totalTextLength = titleLength + subTextLength;

    let layout = scene.layout;
    let imageImportance = scene.imageImportance || 'medium';

    // 如果 AI 没有决定布局，使用智能默认规则
    if (!layout) {
      if (totalTextLength > 80) {
        // 长文本 → center 布局（图片不会被裁剪）
        layout = 'center';
      } else {
        // 短文本 → 交替 left/center 布局
        layout = i % 2 === 0 ? 'left' : 'center';
      }
    }

    // 如果 AI 没有决定图片重要性，根据截图类型推断
    if (!scene.imageImportance) {
      const screenshotType = cropInfo.type || scene.type || '';
      if (['hero', 'product', 'testimonial'].includes(screenshotType)) {
        imageImportance = 'high';
      } else if (['decorative', 'background'].includes(screenshotType)) {
        imageImportance = 'low';
      } else {
        imageImportance = 'medium';
      }
    }

    // 根据配音时长计算场景时长（主配音 + 过渡时间 + 次配音）
    const audioInfo = audioDurations[i] || { mainDuration: 3, subDuration: 0 };
    // 主配音和次配音之间的过渡时间（秒）
    const transitionDuration = 0.5;
    // 总时长 = 主配音时长 + 过渡时间 + 次配音时长 + 缓冲时间
    const totalAudioDuration = audioInfo.mainDuration + transitionDuration + audioInfo.subDuration;
    const sceneDurationFrames = Math.ceil((totalAudioDuration + 0.5) * FPS); // 加0.5秒缓冲

    // intro 使用合并后的单个音频文件，其他场景使用分开的两个文件
    const isIntro = i === 0;
    const audioFile = isIntro ? 'intro.mp3' : `scene${i - 1}-main.mp3`;
    const audioFileSub = isIntro ? undefined : `scene${i - 1}-sub.mp3`;
    // intro 的总时长是合并音频的时长
    const mainDuration = isIntro ? totalAudioDuration : audioInfo.mainDuration;
    const subDuration = isIntro ? 0 : audioInfo.subDuration;

    timeline.scenes.push({
      id: isIntro ? 'intro' : `scene${i - 1}`,
      layout: layout,
      imageImportance: imageImportance,
      layoutReason: scene.layoutReason || `AI决策: ${totalTextLength}字符文本 + ${imageImportance}重要性图片`,
      title: scene.title,
      subText: scene.subText,
      img: screenshotFile,
      text: isIntro ? `${script.product}. ${scene.title}.` : scene.title,
      audioFile: audioFile,
      ...(audioFileSub && { audioFileSub: audioFileSub }),
      mainDuration: mainDuration,
      subDuration: subDuration,
      ...(subDuration > 0 && { transitionDuration: transitionDuration }),
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

  // outro - 使用合并后的单个音频文件
  const outroAudioInfo = audioDurations[audioDurations.length - 1] || { mainDuration: 3, subDuration: 0 };
  const outroTotalDuration = outroAudioInfo.mainDuration + outroAudioInfo.subDuration;
  const outroDurationFrames = Math.ceil((outroTotalDuration + 1) * FPS);

  timeline.scenes.push({
    id: 'outro',
    layout: 'center',
    title: `Try ${script.product}`,
    subText: script.tagline,
    text: `${script.product}. ${script.tagline}.`,
    audioFile: 'outro.mp3',
    mainDuration: outroTotalDuration,
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
// 步骤3: 生成配音 (返回音频时长数组) - 并发版本
// 支持 main (主文案) 和 sub (次文案) 分别生成配音
// intro 和 outro 使用合并的单个音频，其他场景保持两阶段动画
// ==========================================
async function generateVoiceovers(scenes, outputDir = './public') {
  console.log('\n[3/5] 🎤 生成 AI 配音 (并发模式)...');

  // 检查是否使用 ElevenLabs
  const useElevenLabs = CONFIG.TTS_SERVICE === 'elevenlabs';
  if (useElevenLabs) {
    const { isElevenLabsConfigured } = require('./elevenlabs-tts.js');
    if (!isElevenLabsConfigured()) {
      console.log('   ⚠️ ElevenLabs 未配置，回退到 edge-tts');
    } else {
      console.log(`   🎯 使用 ElevenLabs (${CONFIG.ELEVENLABS_VOICE})`);
    }
  } else {
    console.log(`   🎯 使用 edge-tts (${CONFIG.VOICE})`);
  }

  // 收集所有需要生成的配音任务
  const tasks = [];
  scenes.forEach((scene) => {
    const isIntroOrOutro = scene.id === 'intro' || scene.id === 'outro';

    if (isIntroOrOutro) {
      // intro 和 outro: 合并 title 和 subText 为单个音频
      const mergedText = scene.subText && scene.subText.trim()
        ? `${scene.title} ${scene.subText}`
        : scene.title;
      tasks.push({
        id: scene.id,
        type: 'combined',
        text: mergedText,
        fileName: `${scene.id}.mp3`
      });
    } else {
      // 其他场景: 保持两阶段动画，分开生成 main 和 sub
      if (scene.title) {
        tasks.push({
          id: scene.id,
          type: 'main',
          text: scene.title,
          fileName: `${scene.id}-main.mp3`
        });
      }
      if (scene.subText && scene.subText.trim()) {
        tasks.push({
          id: scene.id,
          type: 'sub',
          text: scene.subText,
          fileName: `${scene.id}-sub.mp3`
        });
      }
    }
  });

  console.log(`   ⚡ 并发生成 ${tasks.length} 段语音...`);

  // 并发生成所有语音
  const startTime = Date.now();
  const results = await Promise.all(
    tasks.map(async (task) => {
      const outputPath = path.join(outputDir, task.fileName);

      console.log(`   🎙️ 开始 ${task.id}-${task.type}...`);

      try {
        let success = false;

        // 尝试使用 ElevenLabs
        if (useElevenLabs) {
          const { isElevenLabsConfigured, generateSpeech } = require('./elevenlabs-tts.js');
          if (isElevenLabsConfigured()) {
            success = await generateSpeech(task.text, outputPath, CONFIG.ELEVENLABS_VOICE);
          }
        }

        // 回退到 edge-tts
        if (!success) {
          const text = task.text.replace(/"/g, '\\"');
          const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
          execSync(`${pythonCmd} -m edge_tts --voice ${CONFIG.VOICE} --text "${text}" --write-media "${outputPath}"`, {
            stdio: 'pipe'
          });
          success = true;
        }

        // 读取音频时长
        const duration = getAudioDuration(outputPath);
        console.log(`   ✅ ${task.id}-${task.type} 完成 (${duration.toFixed(2)}秒)`);
        return { id: task.id, type: task.type, duration, success: true };
      } catch (e) {
        console.log(`   ⚠️ ${task.id}-${task.type} 失败: ${e.message}`);
        return { id: task.id, type: task.type, duration: 3, success: false };
      }
    })
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ 配音生成完成 (耗时 ${elapsed}秒)`);

  // 转换为按场景分组的格式
  const audioDurations = [];
  scenes.forEach(scene => {
    const isIntroOrOutro = scene.id === 'intro' || scene.id === 'outro';

    if (isIntroOrOutro) {
      // intro/outro: combined 类型，总时长就是 combined 音频的时长
      const combinedResult = results.find(r => r.id === scene.id && r.type === 'combined');
      audioDurations.push({
        id: scene.id,
        mainDuration: combinedResult ? combinedResult.duration : 3,
        subDuration: 0
      });
    } else {
      // 其他场景: main + sub
      const mainResult = results.find(r => r.id === scene.id && r.type === 'main');
      const subResult = results.find(r => r.id === scene.id && r.type === 'sub');
      audioDurations.push({
        id: scene.id,
        mainDuration: mainResult ? mainResult.duration : 0,
        subDuration: subResult ? subResult.duration : 0
      });
    }
  });

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

  const rootPublicDir = path.join(__dirname, 'public');
  console.log(`   📂 根目录 public: ${rootPublicDir}`);
  console.log(`   📂 网站 public: ${publicDir}`);

  // 列出当前 public 目录内容
  if (fs.existsSync(rootPublicDir)) {
    const existingFiles = fs.readdirSync(rootPublicDir);
    console.log(`   📄 现有 public 文件: ${existingFiles.join(', ')}`);

    // 验证 BGM 文件
    const bgmPath = path.join(rootPublicDir, 'bensound-slowlife.mp3');
    if (fs.existsSync(bgmPath)) {
      const stats = fs.statSync(bgmPath);
      console.log(`   ✅ BGM 文件存在: ${stats.size} bytes`);
    } else {
      console.log(`   ❌ 致命错误: BGM 文件不存在`);
      return null;
    }
  } else {
    console.log(`   ❌ 致命错误: public 目录不存在`);
    return null;
  }

  // 将网站生成的文件复制到 public 目录（追加模式，不删除现有文件）
  if (fs.existsSync(publicDir)) {
    const files = fs.readdirSync(publicDir);
    let copiedCount = 0;
    for (const file of files) {
      const srcPath = path.join(publicDir, file);
      const destPath = path.join(rootPublicDir, file);
      try {
        if (fs.statSync(srcPath).isDirectory()) {
          // 如果目标目录存在，先删除
          if (fs.existsSync(destPath)) {
            fs.rmSync(destPath, { recursive: true });
          }
          fs.cpSync(srcPath, destPath, { recursive: true });
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
        copiedCount++;
      } catch (e) {
        console.log(`   ⚠️ 复制失败 ${file}: ${e.message}`);
      }
    }
    console.log(`   📁 复制网站文件: ${copiedCount} 个`);
  }

  // 验证最终文件
  const finalFiles = fs.readdirSync(rootPublicDir);
  const bgmPath = path.join(rootPublicDir, 'bensound-slowlife.mp3');
  const timelinePath = path.join(rootPublicDir, 'timeline.json');

  if (!fs.existsSync(bgmPath)) {
    console.log(`   ❌ 致命错误: BGM 文件丢失`);
    return null;
  }
  if (!fs.existsSync(timelinePath)) {
    console.log(`   ❌ 致命错误: timeline.json 不存在`);
    return null;
  }

  console.log(`   ✅ 最终验证通过，文件数: ${finalFiles.length}`);

  // 查找 Chromium 路径
  let chromiumPath = null;
  const playwrightPath = '/root/.cache/ms-playwright';
  if (fs.existsSync(playwrightPath)) {
    const chromiumDirs = fs.readdirSync(playwrightPath).filter(d => d.startsWith('chromium'));
    if (chromiumDirs.length > 0) {
      const chromePath = path.join(playwrightPath, chromiumDirs[0], 'chrome-linux', 'chrome');
      if (fs.existsSync(chromePath)) {
        chromiumPath = chromePath;
        console.log(`   🌐 Chromium: ${chromePath}`);
      }
    }
  }

  // 渲染命令
  let renderCmd = `npx remotion render ${compositionId} "${outputPath}"`;
  if (chromiumPath) {
    renderCmd += ` --chromium-executable-path="${chromiumPath}"`;
  }
  renderCmd += ' --concurrency=4';

  console.log(`\n   🎬 开始渲染...`);
  console.log(`   📝 命令: ${renderCmd}\n`);

  try {
    execSync(renderCmd, {
      cwd: __dirname,
      stdio: 'inherit',
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' }
    });
    console.log(`\n✅ 视频渲染完成: ${outputFile}`);

    // 清理网站生成的文件（保留原始文件如 BGM）
    const websiteFiles = ['shot1.png', 'shot2.png', 'shot3.png', 'shot4.png', 'shot5.png', 'shot6.png',
                          'scraped.json', 'timeline.json', 'website-shot.png',
                          // intro 和 outro 的音频文件（已合并生成）
                          'intro.mp3', 'outro.mp3'];
    // 添加 scene 的配音文件 (两阶段动画)
    for (let i = 0; i < 10; i++) {
      websiteFiles.push(`scene${i}-main.mp3`, `scene${i}-sub.mp3`);
    }
    for (const file of websiteFiles) {
      const filePath = path.join(rootPublicDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    return outputPath;
  } catch (e) {
    console.error(`\n❌ 渲染失败: ${e.message}`);
    console.error(`   堆栈: ${e.stack}`);
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
    console.log(`\n开始处理: ${url}`);
    console.log(`域名: ${domain}`);
    console.log(`网站目录: ${websiteDir}`);

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
    console.log('\n>>> 步骤 1: 截图');
    console.log(`   outputDir = ${outputDir}`);
    console.log(`   完整路径 = ${path.resolve(outputDir)}`);
    await captureWebsite(url, outputDir);

    // 验证截图结果
    console.log(`\n>>> 验证截图结果:`);
    console.log(`   outputDir 存在: ${fs.existsSync(outputDir)}`);
    const files = fs.existsSync(outputDir) ? fs.readdirSync(outputDir) : [];
    console.log(`   outputDir 文件: ${files.join(', ')}`);

    // 2. AI 分析
    console.log('\n>>> 步骤 2: AI 分析');
    const scrapedPath = path.join(outputDir, 'scraped.json');
    console.log(`   scrapedPath = ${scrapedPath}`);
    console.log(`   scraped.json 存在: ${fs.existsSync(scrapedPath)}`);
    const aiResult = fs.existsSync(scrapedPath)
      ? await analyzeImageWithAI(scrapedPath, outputDir)
      : { script: generateDefaultScript(), style: null };

    const script = aiResult?.script || generateDefaultScript();
    console.log(`   📝 script 存在: ${!!script}, scenes: ${script?.scenes?.length || 0}个`);
    if (!script || !script.scenes) {
      console.log('   ⚠️ AI 返回的 script 无效，使用默认脚本');
    }
    // 如果已有 style，复用它保证一致性；否则使用新生成的 style
    const videoStyle = existingStyle || aiResult?.style;

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

    // 3. 准备配音场景列表（包含主文案和次文案）
    const voiceoverScenes = [];

    // 确保 script.scenes 存在
    if (!script || !script.scenes) {
      console.log('   ⚠️ script 或 script.scenes 未定义，使用默认脚本');
      Object.assign(script, generateDefaultScript());
    }

    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];
      // 主文案: 第一个场景包含产品名
      const title = i === 0
        ? `${script.product}. ${scene.title}.`
        : scene.title;

      voiceoverScenes.push({
        id: i === 0 ? 'intro' : `scene${i - 1}`,
        title: title,
        subText: scene.subText || ''  // 次文案
      });
    }

    // 添加 outro
    voiceoverScenes.push({
      id: 'outro',
      title: `${script.product}. ${script.tagline}.`,
      subText: ''  // outro 没有次文案
    });

    // 生成配音并获取时长
    const audioDurations = await generateVoiceovers(voiceoverScenes, outputDir);

    // 获取可用的截图列表
    const availableScreenshots = scrapedData?.screenshots?.map(s => s.file) || [];
    console.log(`   📸 可用截图: ${availableScreenshots.join(', ') || '无'}`);

    // 4. 生成时间轴 (根据音频时长 + AI 风格 + 裁切策略)
    const timeline = await generateTimeline(script, audioDurations, outputDir, videoStyle, cropStrategies, availableScreenshots);

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
    console.error('错误堆栈:', error.stack);
  }
}

main();
