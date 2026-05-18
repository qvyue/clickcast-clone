"""
VidGen Web Server
提供 URL 输入界面和视频生成服务
"""

import http.server
import socketserver
import json
import subprocess
import threading
import os
import time
from urllib.parse import urlparse, parse_qs
import mimetypes

PORT = 3000

# 任务状态存储
jobs = {}

# Pipeline 步骤定义
PIPELINE_STEPS = [
    {'id': 'capturing', 'name': '截图', 'icon': '📸', 'desc': 'Playwright 访问网站并截图'},
    {'id': 'analyzing', 'name': 'AI分析', 'icon': '🤖', 'desc': '分析截图提取关键信息'},
    {'id': 'script', 'name': '生成文案', 'icon': '📝', 'desc': 'AI 生成视频脚本'},
    {'id': 'voiceover', 'name': '配音', 'icon': '🎤', 'desc': 'edge-TTS 语音合成'},
    {'id': 'timeline', 'name': '时间轴', 'icon': '⏱️', 'desc': '生成视频时间轴配置'},
    {'id': 'rendering', 'name': '渲染', 'icon': '🎬', 'desc': 'Remotion 渲染视频'},
]

class VidGenHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(self.get_html().encode('utf-8'))
        elif self.path == '/preview':
            # 显示预览页面
            preview_path = os.path.join(os.path.dirname(__file__), 'public', 'preview.html')
            if os.path.exists(preview_path):
                self.send_response(200)
                self.send_header('Content-type', 'text/html; charset=utf-8')
                self.end_headers()
                with open(preview_path, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_error(404, 'Preview not found')
        elif self.path.startswith('/api/'):
            self.handle_api()
        else:
            # 静态文件
            super().do_GET()
    
    def do_POST(self):
        if self.path == '/api/generate':
            self.handle_generate()
        else:
            self.send_error(404)
    
    def handle_api(self):
        path = self.path.split('/')
        
        if len(path) >= 4 and path[2] == 'status':
            job_id = path[3]
            self.send_json(self.get_job_status(job_id))
        else:
            self.send_error(404)
    
    def handle_generate(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')

        try:
            data = json.loads(body)
            url = data.get('url', '')
            aspect_ratio = data.get('aspectRatio', 'landscape')  # landscape 或 portrait
        except:
            self.send_error(400, 'Invalid JSON')
            return

        if not url:
            self.send_json({'error': '请输入 URL'}, 400)
            return

        # 验证 URL
        try:
            result = urlparse(url)
            if not result.scheme or not result.netloc:
                raise ValueError()
        except:
            self.send_json({'error': '无效的 URL 格式'}, 400)
            return

        job_id = str(int(time.time() * 1000))

        # 初始化任务状态 - 所有步骤pending
        jobs[job_id] = {
            'url': url,
            'aspectRatio': aspect_ratio,
            'status': 'running',
            'currentStep': 0,
            'steps': [
                {'id': s['id'], 'name': s['name'], 'icon': s['icon'], 'desc': s['desc'], 'status': 'pending', 'error': None}
                for s in PIPELINE_STEPS
            ],
            'error': None
        }

        # 后台启动 pipeline
        thread = threading.Thread(target=self.run_pipeline, args=(url, job_id, aspect_ratio))
        thread.start()
        
        self.send_json({'jobId': job_id, 'message': '任务已提交'})
    
    def update_step(self, job_id, step_id, status, error=None):
        """更新步骤状态"""
        if job_id not in jobs:
            return
        
        steps = jobs[job_id]['steps']
        for i, step in enumerate(steps):
            if step['id'] == step_id:
                step['status'] = status
                if error:
                    step['error'] = error
                jobs[job_id]['currentStep'] = i
                break
    
    def run_pipeline(self, url, job_id, aspect_ratio='landscape'):
        """在后台运行 pipeline - 直接调用 pipeline.js"""
        try:
            # 直接调用 pipeline.js，它已经正确处理了网站专属目录
            self.update_step(job_id, 'capturing', 'running')

            result = subprocess.run(
                ['node', 'pipeline.js', url, aspect_ratio],
                cwd=os.path.dirname(os.path.abspath(__file__)),
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='ignore',
                timeout=300  # 5 分钟超时
            )

            if result.returncode == 0:
                # 所有步骤完成
                for step in PIPELINE_STEPS:
                    self.update_step(job_id, step['id'], 'completed')

                # 从 URL 提取域名
                from urllib.parse import urlparse
                parsed = urlparse(url)
                domain = parsed.hostname.replace('www.', '') if parsed.hostname else 'unknown'

                video_file = 'portrait.mp4' if aspect_ratio == 'portrait' else 'landscape.mp4'
                video_path = os.path.join(os.path.dirname(__file__), 'websites', domain, 'out', video_file)

                if os.path.exists(video_path):
                    jobs[job_id]['status'] = 'completed'
                    jobs[job_id]['domain'] = domain
                    jobs[job_id]['videoUrl'] = f'/websites/{domain}/out/{video_file}'
                else:
                    jobs[job_id]['status'] = 'failed'
                    jobs[job_id]['error'] = '视频文件未生成'
            else:
                self.update_step(job_id, 'capturing', 'failed', result.stderr or 'Pipeline 失败')
                jobs[job_id]['status'] = 'failed'
                jobs[job_id]['error'] = 'Pipeline 失败: ' + (result.stderr or '未知错误')
                return
        except subprocess.TimeoutExpired:
            self.update_step(job_id, 'capturing', 'failed', '处理超时')
            jobs[job_id]['status'] = 'failed'
            jobs[job_id]['error'] = '处理超时（视频较长，请稍后重试）'
            return
        except Exception as e:
            self.update_step(job_id, 'capturing', 'failed', str(e))
            jobs[job_id]['status'] = 'failed'
            jobs[job_id]['error'] = f'处理错误: {str(e)}'
            return

    def get_job_status(self, job_id):
        job = jobs.get(job_id)
        if not job:
            return {'error': '任务不存在'}, 404

        # 获取视频 URL
        video_url = job.get('videoUrl')
        if not video_url and job['status'] == 'completed':
            domain = job.get('domain', 'unknown')
            aspect_ratio = job.get('aspectRatio', 'landscape')
            video_file = 'portrait.mp4' if aspect_ratio == 'portrait' else 'landscape.mp4'
            video_path = os.path.join(os.path.dirname(__file__), 'websites', domain, 'out', video_file)
            if os.path.exists(video_path):
                video_url = f'/websites/{domain}/out/{video_file}'

        return {
            'status': job['status'],
            'currentStep': job.get('currentStep', 0),
            'steps': job['steps'],
            'error': job.get('error'),
            'videoUrl': video_url
        }
    
    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def get_html(self):
        return '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VidGen AI - URL 转视频</title>
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
    textarea {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 10px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      min-height: 100px;
      transition: border-color 0.3s;
    }
    textarea:focus { outline: none; border-color: #4a90e2; }
    textarea::placeholder { color: #aaa; }
    .hint {
      font-size: 12px;
      color: #888;
      margin-top: 4px;
    }
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
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(74, 144, 226, 0.4);
    }
    button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

    /* Ratio Selector */
    .ratio-selector {
      display: flex;
      gap: 12px;
    }
    .ratio-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 12px;
      background: #f8f9fa;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .ratio-btn:hover {
      border-color: #4a90e2;
      background: #f0f7ff;
    }
    .ratio-btn.active {
      border-color: #4a90e2;
      background: #e8f0fe;
    }
    .ratio-icon {
      font-size: 28px;
      margin-bottom: 8px;
    }
    .ratio-label {
      font-weight: 600;
      color: #333;
      font-size: 14px;
    }
    .ratio-desc {
      font-size: 11px;
      color: #888;
      margin-top: 4px;
    }

    /* Pipeline Steps */
    .pipeline { margin-top: 30px; }
    .pipeline-title { font-size: 14px; color: #666; margin-bottom: 15px; }
    .steps-container { display: flex; flex-direction: column; gap: 12px; }
    
    .step {
      display: flex;
      align-items: center;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 12px;
      border: 2px solid transparent;
      transition: all 0.3s;
    }
    
    .step.pending { opacity: 0.6; }
    .step.running { 
      border-color: #4a90e2; 
      background: #e8f0fe;
      animation: pulse 1.5s infinite;
    }
    .step.completed { 
      border-color: #28a745; 
      background: #e8f5e9;
    }
    .step.failed { 
      border-color: #dc3545; 
      background: #fdecea;
    }
    
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(74, 144, 226, 0.4); }
      50% { box-shadow: 0 0 0 8px rgba(74, 144, 226, 0); }
    }
    
    .step-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      border-radius: 50%;
      background: white;
      margin-right: 15px;
      flex-shrink: 0;
    }
    
    .step.completed .step-icon { background: #28a745; }
    .step.running .step-icon { background: #4a90e2; }
    .step.failed .step-icon { background: #dc3545; }
    
    .step-info { flex: 1; }
    .step-name { font-weight: 600; color: #333; font-size: 15px; }
    .step-desc { font-size: 12px; color: #666; margin-top: 2px; }
    
    .step-status {
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 12px;
      font-weight: 500;
    }
    
    .step.pending .step-status { background: #e0e0e0; color: #666; }
    .step.running .step-status { background: #4a90e2; color: white; }
    .step.completed .step-status { background: #28a745; color: white; }
    .step.failed .step-status { background: #dc3545; color: white; }
    
    .step-error {
      display: none;
      margin-top: 8px;
      padding: 10px;
      background: #fff5f5;
      border-radius: 8px;
      font-size: 12px;
      color: #dc3545;
    }
    .step.failed .step-error { display: block; }
    
    /* Result */
    .result { display: none; margin-top: 20px; text-align: center; padding: 20px; background: #e8f5e9; border-radius: 12px; }
    .result.active { display: block; }
    .result.error { background: #fdecea; }
    .result h3 { color: #28a745; margin-bottom: 10px; }
    .result.error h3 { color: #dc3545; }
    .result video { max-width: 100%; border-radius: 12px; margin-top: 15px; }
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
    
    /* Steps footer */
    .steps-footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎬 VidGen AI</h1>
    <p class="subtitle">输入网址，AI 自动生成营销视频</p>
    
    <div class="input-group">
      <label for="url">网站 URL</label>
      <input type="url" id="url" placeholder="https://example.com" required>
    </div>

    <div class="input-group">
      <label for="aspectRatio">视频比例</label>
      <div class="ratio-selector">
        <button type="button" class="ratio-btn active" data-ratio="landscape" onclick="selectRatio('landscape')">
          <span class="ratio-icon">📺</span>
          <span class="ratio-label">横屏 16:9</span>
          <span class="ratio-desc">YouTube / 网页</span>
        </button>
        <button type="button" class="ratio-btn" data-ratio="portrait" onclick="selectRatio('portrait')">
          <span class="ratio-icon">📱</span>
          <span class="ratio-label">竖屏 9:16</span>
          <span class="ratio-desc">TikTok / Reels</span>
        </button>
      </div>
    </div>

    <button id="generateBtn" onclick="generateVideo()">生成视频</button>
    
    <!-- Pipeline Status -->
    <div class="pipeline" id="pipeline" style="display: none;">
      <p class="pipeline-title">处理流程</p>
      <div class="steps-container" id="stepsContainer"></div>
    </div>
    
    <!-- Result -->
    <div class="result" id="result">
      <h3 id="resultTitle">✅ 视频生成完成！</h3>
      <p id="resultMessage"></p>
      <video id="videoPlayer" controls></video>
      <br>
      <a id="downloadLink" class="download-btn" href="#" download>📥 下载视频</a>
    </div>
    
    <div class="steps-footer">
      <p class="steps-title">完整流程</p>
      <span class="step">🌐 输入 URL</span>
      <span class="step">📸 Playwright 截图</span>
      <span class="step">🤖 AI 分析提炼</span>
      <span class="step">📝 生成文案</span>
      <span class="step">🎤 edge-TTS 配音</span>
      <span class="step">🎬 Remotion 渲染</span>
    </div>
  </div>

  <script>
    let currentJobId = null;
    let pollInterval = null;
    let selectedRatio = 'landscape';

    // Pipeline steps data
    const stepsData = [
      { id: 'capturing', name: '截图', icon: '📸', desc: 'Playwright 访问网站并截图' },
      { id: 'analyzing', name: 'AI分析', icon: '🤖', desc: '分析截图提取关键信息' },
      { id: 'script', name: '生成文案', icon: '📝', desc: 'AI 生成视频脚本' },
      { id: 'voiceover', name: '配音', icon: '🎤', desc: 'edge-TTS 语音合成' },
      { id: 'timeline', name: '时间轴', icon: '⏱️', desc: '生成视频时间轴配置' },
      { id: 'rendering', name: '渲染', icon: '🎬', desc: 'Remotion 渲染视频' }
    ];

    function selectRatio(ratio) {
      selectedRatio = ratio;
      document.querySelectorAll('.ratio-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.ratio === ratio);
      });
    }

    function renderSteps(steps) {
      const container = document.getElementById('stepsContainer');
      container.innerHTML = steps.map((step, i) => `
        <div class="step ${step.status}">
          <div class="step-icon">${step.status === 'completed' ? '✓' : (step.status === 'failed' ? '✕' : step.icon)}</div>
          <div class="step-info">
            <div class="step-name">${step.icon} ${step.name}</div>
            <div class="step-desc">${step.desc}</div>
            ${step.error ? `<div class="step-error">❌ ${step.error}</div>` : ''}
          </div>
          <span class="step-status">${
            step.status === 'pending' ? '等待中' : 
            step.status === 'running' ? '处理中' : 
            step.status === 'completed' ? '已完成' : '失败'
          }</span>
        </div>
      `).join('');
    }

    async function generateVideo() {
      const url = document.getElementById('url').value.trim();
      const btn = document.getElementById('generateBtn');
      const pipeline = document.getElementById('pipeline');
      const result = document.getElementById('result');

      if (!url) {
        alert('请输入 URL');
        return;
      }

      btn.disabled = true;
      btn.textContent = '提交中...';
      pipeline.style.display = 'block';
      result.classList.remove('active', 'error');

      // 初始化步骤显示
      renderSteps(stepsData.map(s => ({...s, status: 'pending', error: null})));

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
        
        if (data.error) {
          clearInterval(pollInterval);
          alert('获取状态失败: ' + data.error);
          return;
        }
        
        // 渲染步骤
        renderSteps(data.steps);
        
        if (data.status === 'completed') {
          clearInterval(pollInterval);
          document.getElementById('resultTitle').textContent = '✅ 视频生成完成！';
          document.getElementById('resultTitle').style.color = '#28a745';
          document.getElementById('resultMessage').textContent = '';
          if (data.videoUrl) {
            document.getElementById('videoPlayer').src = data.videoUrl;
            document.getElementById('downloadLink').href = data.videoUrl;
            document.getElementById('downloadLink').style.display = 'inline-block';
          }
          document.getElementById('result').classList.add('active');
          document.getElementById('generateBtn').disabled = false;
          document.getElementById('generateBtn').textContent = '生成视频';
        }
        
        if (data.status === 'failed') {
          clearInterval(pollInterval);
          document.getElementById('resultTitle').textContent = '❌ 生成失败';
          document.getElementById('resultTitle').style.color = '#dc3545';
          document.getElementById('resultMessage').textContent = data.error || '未知错误';
          document.getElementById('downloadLink').style.display = 'none';
          document.getElementById('videoPlayer').src = '';
          document.getElementById('result').classList.add('active', 'error');
          document.getElementById('generateBtn').disabled = false;
          document.getElementById('generateBtn').textContent = '生成视频';
        }
        
      } catch (error) {
        console.error('Status poll error:', error);
      }
    }
  </script>
</body>
</html>'''


# 确保输出目录存在
out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
if not os.path.exists(out_dir):
    os.makedirs(out_dir)

# 添加静态文件路径
VidGenHandler.directory = os.path.dirname(os.path.abspath(__file__))

with socketserver.TCPServer(("", PORT), VidGenHandler) as httpd:
    print(f"""
========================================
   ClickCast Web UI Started
   http://localhost:{PORT}
========================================
    """)
    httpd.serve_forever()
