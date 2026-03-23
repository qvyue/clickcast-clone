/**
 * ClickCast Web Server
 * 提供 URL 输入界面和视频生成服务
 */

const express = require('express');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 加载环境变量 (本地开发)
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/websites', express.static('websites')); // 提供网站目录访问

// 任务状态存储
const jobs = new Map();

// R2 存储 URL 缓存
const r2VideoUrls = new Map();

/**
 * 从 URL 提取域名
 */
function extractDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch (e) {
    return `unknown-${Date.now()}`;
  }
}

// 启动 pipeline 并返回进度
function runPipeline(url, aspectRatio, jobId) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };

    const pipelineProcess = spawn('node', ['pipeline.js', url, aspectRatio], {
      cwd: __dirname,
      env,
      shell: true
    });

    let output = '';

    pipelineProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log(text);

      // 解析进度
      if (text.includes('截图')) {
        jobs.set(jobId, { status: 'capturing', progress: 10, message: '正在截图...', aspectRatio, url });
      } else if (text.includes('AI 分析')) {
        jobs.set(jobId, { status: 'analyzing', progress: 30, message: '正在 AI 分析...', aspectRatio, url });
      } else if (text.includes('时间轴')) {
        jobs.set(jobId, { status: 'generating', progress: 50, message: '正在生成时间轴...', aspectRatio, url });
      } else if (text.includes('配音')) {
        jobs.set(jobId, { status: 'voiceover', progress: 70, message: '正在生成配音...', aspectRatio, url });
      } else if (text.includes('渲染')) {
        jobs.set(jobId, { status: 'rendering', progress: 85, message: '正在渲染视频...', aspectRatio, url });
      }
    });

    pipelineProcess.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    pipelineProcess.on('close', (code) => {
      if (code === 0) {
        jobs.set(jobId, { status: 'completed', progress: 100, message: '完成!', aspectRatio, url });
        resolve({ success: true });
      } else {
        jobs.set(jobId, { status: 'failed', progress: 0, message: '生成失败', aspectRatio, url });
        reject(new Error(`Pipeline exited with code ${code}`));
      }
    });
  });
}

// API: 提交任务
app.post('/api/generate', async (req, res) => {
  let { url, aspectRatio } = req.body;

  if (!url) {
    return res.status(400).json({ error: '请输入 URL' });
  }

  const ratio = aspectRatio || 'landscape';
  if (!['landscape', 'portrait'].includes(ratio)) {
    return res.status(400).json({ error: '无效的比例参数' });
  }

  // 自动补全 URL 协议
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // 验证 URL 格式
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname || !parsedUrl.hostname.includes('.')) {
      throw new Error('Invalid hostname');
    }
  } catch (e) {
    return res.status(400).json({ error: '无效的 URL 格式，请输入正确的网址（如 github.com）' });
  }

  const jobId = Date.now().toString();
  jobs.set(jobId, { status: 'pending', progress: 0, message: '准备中...', aspectRatio: ratio, url });

  console.log(`\n新任务: ${jobId} - ${url} (${ratio})`);

  res.json({ jobId, message: '任务已提交', aspectRatio: ratio });

  try {
    await runPipeline(url, ratio, jobId);
    console.log(`任务完成: ${jobId}`);
  } catch (error) {
    console.error(`任务失败: ${jobId}`, error);
  }
});

// API: 查询任务状态
app.get('/api/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: '任务不存在' });
  }

  // 根据网站 URL 计算视频路径
  const domain = extractDomainFromUrl(job.url || '');
  const videoFile = job.aspectRatio === 'portrait' ? 'portrait.mp4' : 'landscape.mp4';

  // 优先使用 R2 URL (云端存储)
  const r2Key = `videos/${domain}/${videoFile}`;
  const r2Url = r2VideoUrls.get(r2Key);

  if (r2Url) {
    // R2 已上传，直接返回云端 URL
    return res.json({
      ...job,
      domain,
      videoUrl: r2Url,
      storage: 'r2'
    });
  }

  // 检查本地文件
  const videoPath = path.join(__dirname, 'websites', domain, 'out', videoFile);
  const videoExists = fs.existsSync(videoPath);

  // 视频访问 URL (本地)
  const videoUrl = videoExists ? `/websites/${domain}/out/${videoFile}` : null;

  res.json({
    ...job,
    domain,
    videoUrl,
    storage: videoExists ? 'local' : null
  });
});

// API: 注册 R2 视频 URL (pipeline 完成后调用)
app.post('/api/r2-register', (req, res) => {
  const { key, url } = req.body;

  if (!key || !url) {
    return res.status(400).json({ error: '缺少参数' });
  }

  r2VideoUrls.set(key, url);
  console.log(`R2 视频已注册: ${key} -> ${url}`);

  res.json({ success: true });
});

// API: 获取视频
app.get('/api/video/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: '任务不存在' });
  }

  const domain = extractDomainFromUrl(job.url || '');
  const videoFile = job.aspectRatio === 'portrait' ? 'portrait.mp4' : 'landscape.mp4';
  const videoPath = path.join(__dirname, 'websites', domain, 'out', videoFile);

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: '视频不存在' });
  }

  res.download(videoPath, `${domain}-${videoFile}`);
});

// API: 获取已生成的视频列表
app.get('/api/videos', async (req, res) => {
  const websitesDir = path.join(__dirname, 'websites');
  const videos = [];

  // 检查 R2 是否配置
  const { isR2Configured, listVideos } = require('./r2-storage.js');
  const useR2 = isR2Configured();

  // 如果 R2 配置了，优先从 R2 获取视频列表
  if (useR2) {
    try {
      const r2Videos = await listVideos();
      r2Videos.forEach(v => {
        const parts = v.key.split('/');
        const domain = parts[1];
        const file = parts[2];
        if (domain && file) {
          videos.push({
            domain,
            file,
            url: v.url,
            size: v.size ? Math.round(v.size / 1024 / 1024 * 10) / 10 : null,
            created: v.lastModified,
            storage: 'r2'
          });
        }
      });
    } catch (e) {
      console.error('R2 list error:', e.message);
    }
  }

  // 同时检查本地存储 (兼容本地开发)
  if (fs.existsSync(websitesDir)) {
    const domains = fs.readdirSync(websitesDir).filter(f => {
      return fs.statSync(path.join(websitesDir, f)).isDirectory();
    });

    domains.forEach(domain => {
      const outDir = path.join(websitesDir, domain, 'out');
      if (fs.existsSync(outDir)) {
        ['landscape.mp4', 'portrait.mp4'].forEach(videoFile => {
          const videoPath = path.join(outDir, videoFile);
          if (fs.existsSync(videoPath)) {
            // 检查是否已从 R2 获取
            const exists = videos.some(v => v.domain === domain && v.file === videoFile);
            if (!exists) {
              const stats = fs.statSync(videoPath);
              videos.push({
                domain,
                file: videoFile,
                url: `/websites/${domain}/out/${videoFile}`,
                size: Math.round(stats.size / 1024 / 1024 * 10) / 10, // MB
                created: stats.mtime,
                storage: 'local'
              });
            }
          }
        });
      }
    });
  }

  res.json({ videos, r2Enabled: useR2 });
});

// 首页 HTML
const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClickCast AI - URL to Video</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 700px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    h1 { color: #1a1a2e; margin-bottom: 8px; font-size: 28px; }
    .subtitle { color: #666; margin-bottom: 30px; font-size: 14px; }
    .input-group { margin-bottom: 20px; }
    label { display: block; margin-bottom: 8px; color: #333; font-weight: 500; }
    input[type="url"] {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 10px;
      font-size: 16px;
      transition: border-color 0.3s;
    }
    input[type="url"]:focus { outline: none; border-color: #4a90e2; }
    .ratio-selector { display: flex; gap: 15px; margin-bottom: 20px; }
    .ratio-option {
      flex: 1;
      padding: 20px;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      cursor: pointer;
      text-align: center;
      transition: all 0.3s;
    }
    .ratio-option:hover { border-color: #4a90e2; }
    .ratio-option.selected {
      border-color: #4a90e2;
      background: linear-gradient(135deg, rgba(74, 144, 226, 0.1) 0%, rgba(123, 104, 238, 0.1) 100%);
    }
    .ratio-icon {
      width: 60px;
      height: 40px;
      margin: 0 auto 10px;
      border: 2px solid #666;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: #666;
    }
    .ratio-option.selected .ratio-icon { border-color: #4a90e2; color: #4a90e2; }
    .ratio-option.selected .ratio-label { color: #4a90e2; font-weight: 600; }
    .ratio-label { font-size: 14px; color: #333; }
    .ratio-desc { font-size: 12px; color: #999; margin-top: 4px; }
    button {
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #4a90e2 0%, #7b68ee 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(74, 144, 226, 0.4); }
    button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .progress-container {
      display: none;
      margin-top: 30px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 12px;
    }
    .progress-container.active { display: block; }
    .progress-text { text-align: center; margin-bottom: 15px; color: #333; font-size: 15px; }
    .progress-bar { height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4a90e2, #7b68ee);
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .result { display: none; margin-top: 20px; text-align: center; }
    .result.active { display: block; }
    .result video { max-width: 100%; max-height: 400px; border-radius: 12px; margin-top: 15px; }
    .result video.portrait { max-height: 500px; }
    .download-btn {
      display: inline-block;
      margin-top: 15px;
      padding: 12px 30px;
      background: #28a745;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
    }
    .video-list {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
    .video-list h3 { font-size: 16px; color: #333; margin-bottom: 15px; }
    .video-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 15px;
      background: #f8f9fa;
      border-radius: 8px;
      margin-bottom: 10px;
    }
    .video-info { text-align: left; }
    .video-domain { font-weight: 600; color: #333; }
    .video-meta { font-size: 12px; color: #666; }
    .video-actions a {
      display: inline-block;
      padding: 6px 12px;
      background: #4a90e2;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      font-size: 12px;
      margin-left: 8px;
    }
    .steps { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
    .steps-title { font-size: 12px; color: #999; margin-bottom: 10px; }
    .step {
      display: inline-block;
      padding: 6px 12px;
      background: #f0f0f0;
      border-radius: 20px;
      font-size: 12px;
      color: #666;
      margin-right: 8px;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>ClickCast AI</h1>
    <p class="subtitle">输入网址，AI 自动生成营销视频</p>
    <div class="input-group">
      <label for="url">网站 URL</label>
      <input type="url" id="url" placeholder="github.com 或 https://example.com" required>
    </div>
    <label>视频比例</label>
    <div class="ratio-selector">
      <div class="ratio-option selected" data-ratio="landscape" onclick="selectRatio('landscape')">
        <div class="ratio-icon" style="width:70px;height:40px;">16:9</div>
        <div class="ratio-label">横屏</div>
        <div class="ratio-desc">适合 YouTube、网页</div>
      </div>
      <div class="ratio-option" data-ratio="portrait" onclick="selectRatio('portrait')">
        <div class="ratio-icon" style="width:34px;height:60px;">9:16</div>
        <div class="ratio-label">竖屏</div>
        <div class="ratio-desc">适合 TikTok、短视频</div>
      </div>
    </div>
    <button id="generateBtn" onclick="generateVideo()">生成视频</button>
    <div class="progress-container" id="progress">
      <p class="progress-text" id="progressText">准备中...</p>
      <div class="progress-bar">
        <div class="progress-fill" id="progressFill" style="width: 0%"></div>
      </div>
    </div>
    <div class="result" id="result">
      <p>视频生成完成!</p>
      <video id="videoPlayer" controls></video>
      <br>
      <a id="downloadLink" class="download-btn" href="#" download>下载视频</a>
    </div>

    <div class="video-list" id="videoListSection" style="display:none;">
      <h3>已生成的视频</h3>
      <div id="videoList"></div>
    </div>

    <div class="steps">
      <p class="steps-title">完整流程</p>
      <span class="step">输入 URL</span>
      <span class="step">Playwright 截图</span>
      <span class="step">AI 分析提炼</span>
      <span class="step">生成文案</span>
      <span class="step">edge-TTS 配音</span>
      <span class="step">Remotion 渲染</span>
    </div>
  </div>
  <script>
    let currentJobId = null;
    let pollInterval = null;
    let selectedRatio = 'landscape';

    async function loadVideoList() {
      try {
        const res = await fetch('/api/videos');
        const data = await res.json();

        if (data.videos && data.videos.length > 0) {
          document.getElementById('videoListSection').style.display = 'block';
          document.getElementById('videoList').innerHTML = data.videos.map(v =>
            '<div class="video-item">' +
              '<div class="video-info">' +
                '<div class="video-domain">' + v.domain + '</div>' +
                '<div class="video-meta">' + v.file + ' · ' + v.size + ' MB</div>' +
              '</div>' +
              '<div class="video-actions">' +
                '<a href="' + v.url + '" target="_blank">播放</a>' +
                '<a href="' + v.url + '" download>下载</a>' +
              '</div>' +
            '</div>'
          ).join('');
        }
      } catch (e) {
        console.error('加载视频列表失败:', e);
      }
    }

    function selectRatio(ratio) {
      selectedRatio = ratio;
      document.querySelectorAll('.ratio-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.ratio === ratio);
      });
    }

    async function generateVideo() {
      const url = document.getElementById('url').value.trim();
      const btn = document.getElementById('generateBtn');
      const progress = document.getElementById('progress');
      const result = document.getElementById('result');

      if (!url) { alert('请输入 URL'); return; }

      btn.disabled = true;
      btn.textContent = '提交中...';
      progress.classList.add('active');
      result.classList.remove('active');
      document.getElementById('progressFill').style.width = '0%';

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, aspectRatio: selectedRatio })
        });
        const data = await res.json();

        if (data.error) {
          alert(data.error);
          btn.disabled = false;
          btn.textContent = '生成视频';
          return;
        }

        currentJobId = data.jobId;
        btn.textContent = '生成中...';
        pollStatus();
        pollInterval = setInterval(pollStatus, 2000);
      } catch (error) {
        alert('提交失败: ' + error.message);
        btn.disabled = false;
        btn.textContent = '生成视频';
      }
    }

    async function pollStatus() {
      if (!currentJobId) return;
      try {
        const res = await fetch('/api/status/' + currentJobId);
        const data = await res.json();

        document.getElementById('progressText').textContent = data.message;
        document.getElementById('progressFill').style.width = data.progress + '%';

        if (data.status === 'completed') {
          clearInterval(pollInterval);
          if (data.videoUrl) {
            const vp = document.getElementById('videoPlayer');
            vp.src = data.videoUrl;
            vp.classList.toggle('portrait', data.aspectRatio === 'portrait');
            document.getElementById('downloadLink').href = data.videoUrl;
          }
          document.getElementById('result').classList.add('active');
          document.getElementById('generateBtn').disabled = false;
          document.getElementById('generateBtn').textContent = '生成视频';
          loadVideoList();
        }

        if (data.status === 'failed') {
          clearInterval(pollInterval);
          alert('生成失败，请重试');
          document.getElementById('generateBtn').disabled = false;
          document.getElementById('generateBtn').textContent = '生成视频';
        }
      } catch (error) {
        console.error('Status poll error:', error);
      }
    }

    loadVideoList();
  </script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.send(indexHtml);
});

// 确保网站目录存在
const websitesDir = path.join(__dirname, 'websites');
if (!fs.existsSync(websitesDir)) {
  fs.mkdirSync(websitesDir, { recursive: true });
}

// 验证 BGM 文件存在
const bgmPath = path.join(__dirname, 'public', 'bensound-slowlife.mp3');
if (fs.existsSync(bgmPath)) {
  const stats = fs.statSync(bgmPath);
  console.log(`✅ BGM 文件已找到: ${stats.size} bytes`);
} else {
  console.log(`⚠️ BGM 文件缺失: ${bgmPath}`);
}

app.listen(PORT, () => {
  console.log(`
========================================
   ClickCast Web UI
   http://localhost:${PORT}
========================================
  `);
});