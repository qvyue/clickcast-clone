/**
 * 预览系统
 *
 * 在渲染前展示 AI 生成的内容，允许用户确认或修改
 */

const fs = require('fs');
const path = require('path');

/**
 * 生成预览页面
 */
function generatePreviewPage(script, websiteType, style) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>视频预览 - ClickCast AI</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: white;
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container { max-width: 1000px; margin: 0 auto; }

    h1 { font-size: 28px; margin-bottom: 10px; }
    .subtitle { color: #94a3b8; margin-bottom: 30px; }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 30px;
    }
    .info-card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 16px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .info-label { font-size: 12px; color: #94a3b8; margin-bottom: 4px; }
    .info-value { font-size: 16px; font-weight: 600; }

    .scenes-title { font-size: 18px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .scenes-grid { display: flex; flex-direction: column; gap: 16px; }

    .scene-card {
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      padding: 20px;
      border: 1px solid rgba(255,255,255,0.1);
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 20px;
    }
    .scene-preview {
      background: #1e293b;
      border-radius: 8px;
      overflow: hidden;
      aspect-ratio: 16/10;
    }
    .scene-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .scene-content { display: flex; flex-direction: column; justify-content: center; }
    .scene-id {
      font-size: 12px;
      color: ${style.colors.primary};
      font-weight: 600;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .scene-title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .scene-voiceover {
      font-size: 14px;
      color: #94a3b8;
      margin-bottom: 4px;
    }
    .scene-voiceover span {
      color: white;
      background: rgba(155, 77, 255, 0.2);
      padding: 2px 8px;
      border-radius: 4px;
    }

    .actions {
      margin-top: 30px;
      display: flex;
      gap: 16px;
      justify-content: center;
    }
    .btn {
      padding: 16px 40px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-primary {
      background: ${style.colors.primary};
      color: white;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(155, 77, 255, 0.4);
    }
    .btn-secondary {
      background: transparent;
      color: white;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .btn-secondary:hover {
      background: rgba(255,255,255,0.05);
    }

    .style-preview {
      margin-top: 30px;
      padding: 20px;
      background: ${style.colors.background};
      border-radius: 16px;
      border: 1px solid ${style.colors.primary}33;
    }
    .style-title { font-size: 14px; color: #94a3b8; margin-bottom: 12px; }
    .color-swatches { display: flex; gap: 12px; }
    .color-swatch {
      width: 50px;
      height: 50px;
      border-radius: 8px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 4px;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎬 视频预览</h1>
    <p class="subtitle">AI Agent 已为您生成视频脚本，请确认后开始渲染</p>

    <div class="info-grid">
      <div class="info-card">
        <div class="info-label">网站类型</div>
        <div class="info-value">${websiteType?.type || 'SAAS'}</div>
      </div>
      <div class="info-card">
        <div class="info-label">视频风格</div>
        <div class="info-value">${style.name}</div>
      </div>
      <div class="info-card">
        <div class="info-label">目标受众</div>
        <div class="info-value">${websiteType?.targetAudience || 'General'}</div>
      </div>
    </div>

    <h2 class="scenes-title">📹 场景列表 (${script.scenes?.length || 0} 个)</h2>

    <div class="scenes-grid">
      ${(script.scenes || []).map((scene, i) => `
      <div class="scene-card">
        <div class="scene-preview">
          <img src="/public/${scene.screenshot || scene.img || `shot${i+1}.png`}" alt="Scene ${i+1}">
        </div>
        <div class="scene-content">
          <div class="scene-id">${scene.id || `Scene ${i+1}`}</div>
          <div class="scene-title">${scene.title}</div>
          <div class="scene-voiceover">
            配音: <span>${scene.voiceover || scene.text || scene.title}</span>
          </div>
          ${scene.subText ? `<div style="font-size: 14px; color: #64748b; margin-top: 8px;">${scene.subText}</div>` : ''}
        </div>
      </div>
      `).join('')}
    </div>

    <div class="style-preview">
      <div class="style-title">🎨 视频配色方案</div>
      <div class="color-swatches">
        <div class="color-swatch" style="background: ${style.colors.primary}">主色</div>
        <div class="color-swatch" style="background: ${style.colors.secondary}">次色</div>
        <div class="color-swatch" style="background: ${style.colors.accent}">强调</div>
        <div class="color-swatch" style="background: ${style.colors.background}; border: 1px solid #333;">背景</div>
      </div>
    </div>

    <div class="actions">
      <button class="btn btn-secondary" onclick="editScript()">✏️ 编辑脚本</button>
      <button class="btn btn-primary" onclick="confirmRender()">✅ 确认并渲染</button>
    </div>
  </div>

  <script>
    function confirmRender() {
      fetch('/api/confirm-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true })
      }).then(() => {
        window.location.href = '/';
      });
    }

    function editScript() {
      const scriptJson = ${JSON.stringify(script)};
      // 打开编辑界面
      alert('编辑功能开发中...');
    }
  </script>
</body>
</html>`;

  return html;
}

/**
 * 保存预览页面
 */
function savePreview(script, websiteType, outputDir = './public') {
  const { getStyleForType } = require('./video-styles.js');
  const style = getStyleForType(websiteType?.type);

  const html = generatePreviewPage(script, websiteType, style);
  const previewPath = path.join(outputDir, 'preview.html');
  fs.writeFileSync(previewPath, html);

  console.log(`✅ 预览页面已生成: ${previewPath}`);
  return previewPath;
}

module.exports = {
  generatePreviewPage,
  savePreview
};