// generate-audio.js
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

const VOICE = process.env.VOICE || 'en-US-ChristopherNeural';
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

console.log('🎙️ 开始生成免费高保真 AI 配音 (Edge TTS)...');

// 读取 AI 生成的脚本
const scriptPath = path.join(publicDir, 'ai-script.json');
if (!fs.existsSync(scriptPath)) {
  console.error('❌ 找不到 ai-script.json，请先运行 generate-script.js');
  process.exit(1);
}

const scriptData = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));

scriptData.script.forEach(scene => {
  const outputPath = path.join(publicDir, `${scene.id}.mp3`);
  const cmd = `python -m edge_tts --voice ${VOICE} --text "${scene.text}" --write-media "${outputPath}"`;

  try {
    console.log(`⏳ 正在生成: ${scene.id}.mp3`);
    execSync(cmd, { stdio: 'pipe' });
  } catch (err) {
    console.error(`❌ 生成 ${scene.id} 失败:`, err.message);
  }
});

console.log('✅ 所有配音已生成并存入 public 目录！');