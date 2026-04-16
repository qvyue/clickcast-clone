// build-timeline.js
const { execSync } = require('child_process');
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

const FPS = 30;
const AUDIO_START_DELAY = 10;
const AUDIO_END_PADDING = 15;

// 使用 ffprobe 获取音频时长
function getAudioDuration(filePath) {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return parseFloat(result.trim());
  } catch (e) {
    console.log(`⚠️ 无法读取音频时长: ${e.message}`);
    return 3;
  }
}

async function buildTimeline() {
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

  // 读取 AI 生成的脚本
  const scriptPath = path.join(publicDir, 'ai-script.json');
  if (!fs.existsSync(scriptPath)) {
    console.error('❌ 找不到 ai-script.json，请先运行 generate-script.js');
    process.exit(1);
  }

  const scriptData = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));

  const timelineConfig = {
    fps: FPS,
    totalFrames: 0,
    scenes: []
  };

  console.log('🎬 开始计算动态时间轴...');
  let currentStartFrame = 0;

  for (const scene of scriptData.script) {
    const audioFileName = `${scene.id}.mp3`;
    const audioPath = path.join(publicDir, audioFileName);

    // 检查音频文件是否存在
    if (!fs.existsSync(audioPath)) {
      console.log(`⚠️ 音频文件不存在: ${audioFileName}`);
      continue;
    }

    // 读取音频时长
    const durationSec = getAudioDuration(audioPath);
    const audioFrames = Math.ceil(durationSec * FPS);
    const sceneDurationFrames = AUDIO_START_DELAY + audioFrames + AUDIO_END_PADDING;

    timelineConfig.scenes.push({
      ...scene,
      audioFile: audioFileName,
      startFrame: currentStartFrame,
      durationInFrames: sceneDurationFrames,
      audioStartFrame: AUDIO_START_DELAY
    });

    currentStartFrame += sceneDurationFrames;
  }

  timelineConfig.totalFrames = currentStartFrame + 30;

  fs.writeFileSync(path.join(publicDir, 'timeline.json'), JSON.stringify(timelineConfig, null, 2));
  console.log('✅ 时间轴计算完毕！总帧数:', timelineConfig.totalFrames);
}

buildTimeline();