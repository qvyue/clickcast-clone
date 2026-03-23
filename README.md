# ClickCast - AI Website to Video Generator

<div align="center">

**输入 URL，自动生成带配音、配乐的营销视频**

[English](#english) | [中文](#中文)

</div>

---

## 中文

### ✨ 功能特点

- 🎯 **一键生成** - 输入 URL，自动截图、分析、生成视频
- 📦 **DOM 元素截图** - AI 智能挑选最佳区块，精准截取，完美贴合边缘
- 🤖 **AI 驱动** - 使用 DeepSeek/GPT-4 智能分析网站内容
- 🎙️ **自动配音** - edge-TTS 高质量语音合成
- 🎵 **智能配乐** - 自动匹配背景音乐
- 🎨 **主题适配** - 根据网站主色调自动调整视频配色
- 📱 **多比例支持** - 横屏 16:9 / 竖屏 9:16
- 🌐 **Web UI** - 可视化操作界面

### 🚀 快速开始

#### 1. 安装依赖

```bash
git clone https://github.com/qvyue/clickcast-clone.git
cd clickcast-clone
npm install
npx playwright install chromium
```

#### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
DEEPSEEK_API_KEY=your_api_key_here
API_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat
VOICE=en-US-ChristopherNeural
BGM_VOLUME=0.15
```

> 获取 DeepSeek API Key: https://platform.deepseek.com

#### 3. 启动 Web 界面

```bash
node server.js
```

访问 http://localhost:3000，输入 URL 即可生成视频。

### 📋 工作流程

```
URL → DOM注入探针 → AI挑选区块 → 精准截图 → AI分析 → 生成文案 → TTS配音 → Remotion渲染 → MP4视频
```

### 📸 DOM 元素截图流程

```
1. 注入探针 → 遍历 DOM，为大容器打上 data-ai-id 编号
2. AI 智能挑选 → 根据页面内容决定截图数量 (3-8张)，选择最有价值的区块
3. 精准截图 → 使用 element.screenshot() 完美贴合边缘截取
```

优势：
- ✅ 绝不会把内容拦腰截断
- ✅ 完美贴合区块边缘，不多一像素
- ✅ AI 理解内容，智能决定截图数量
- ✅ 每张截图都有语义价值，无冗余内容

### 🎨 命令行使用

```bash
# 横屏视频 (1920x1080)
node pipeline.js "https://stripe.com" landscape

# 竖屏视频 (1080x1920)
node pipeline.js "https://stripe.com" portrait

# 预览视频
npm start

# 渲染输出
npm run render-landscape  # 横屏
npm run render-portrait   # 竖屏
```

### ⚙️ 配置选项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key | (必填) |
| `API_BASE_URL` | API 地址 | `https://api.deepseek.com` |
| `AI_MODEL` | AI 模型 | `deepseek-chat` |
| `VOICE` | 配音声音 | `en-US-ChristopherNeural` |
| `BGM_VOLUME` | 背景音乐音量 | `0.15` |

**可选配音声音：**

| 男声 | 女声 |
|------|------|
| `en-US-ChristopherNeural` | `en-US-JennyNeural` |
| `en-US-EricNeural` | `en-US-AriaNeural` |
| `en-US-GuyNeural` | `en-US-SaraNeural` |

### 📁 项目结构

```
clickcast-clone/
├── server.js          # Web 服务器
├── pipeline.js        # 主流程控制
├── capture.js         # Playwright 截图
├── ai-agent.js        # AI 分析模块
├── generate-script.js # 文案生成
├── generate-audio.js  # TTS 配音
├── build-timeline.js  # 时间轴生成
├── src/               # Remotion 视频组件
├── public/            # 静态资源（BGM 等）
└── websites/          # 网站专属数据
    └── {domain}/
        ├── public/    # 截图、配音等
        └── out/       # 输出视频
```

### 🚢 部署

支持 Docker 部署到 Render、Railway、Fly.io 等平台。

详见 [Dockerfile](./Dockerfile) 和 [render.yaml](./render.yaml)。

### 📝 注意事项

- 需要 Node.js 18+ 和 Python 3
- API 费用：DeepSeek 约 ¥1/次，GPT-4o 约 $0.02/次
- 部分网站有反爬虫，可能需要手动截图

---

## English

### ✨ Features

- 🎯 **One-click generation** - Enter URL, auto screenshot, analyze, generate video
- 📦 **DOM Element Screenshot** - AI selects best sections, precise capture with pixel-perfect edges
- 🤖 **AI Powered** - Smart content analysis with DeepSeek/GPT-4
- 🎙️ **Auto Voiceover** - High-quality TTS with edge-TTS
- 🎵 **Smart BGM** - Auto-matched background music
- 🎨 **Theme Adaptation** - Auto-adjust video colors based on website theme
- 📱 **Multi-ratio** - Landscape 16:9 / Portrait 9:16
- 🌐 **Web UI** - Visual operation interface

### 🚀 Quick Start

#### 1. Install Dependencies

```bash
git clone https://github.com/qvyue/clickcast-clone.git
cd clickcast-clone
npm install
npx playwright install chromium
```

#### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` file:

```env
DEEPSEEK_API_KEY=your_api_key_here
API_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat
VOICE=en-US-ChristopherNeural
BGM_VOLUME=0.15
```

> Get DeepSeek API Key: https://platform.deepseek.com

#### 3. Start Web UI

```bash
node server.js
```

Visit http://localhost:3000, enter URL to generate video.

### 📋 Pipeline

```
URL → DOM Probe Injection → AI Selection → Precise Screenshot → AI Analysis → Script → TTS → Render → MP4
```

### 📸 DOM Element Screenshot Process

```
1. Inject Probes → Traverse DOM, tag large containers with data-ai-id
2. AI Smart Selection → AI decides screenshot count (3-8) based on content richness
3. Precise Capture → Use element.screenshot() for pixel-perfect edges
```

Advantages:
- ✅ Never cuts content in half
- ✅ Pixel-perfect edge alignment
- ✅ AI understands content, smartly decides screenshot count
- ✅ Every screenshot has semantic value, no redundant content

### 🎨 Command Line Usage

```bash
# Landscape video (1920x1080)
node pipeline.js "https://stripe.com" landscape

# Portrait video (1080x1920)
node pipeline.js "https://stripe.com" portrait

# Preview video
npm start

# Render output
npm run render-landscape  # Landscape
npm run render-portrait   # Portrait
```

### ⚙️ Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key | (required) |
| `API_BASE_URL` | API URL | `https://api.deepseek.com` |
| `AI_MODEL` | AI Model | `deepseek-chat` |
| `VOICE` | Voice for TTS | `en-US-ChristopherNeural` |
| `BGM_VOLUME` | Background music volume | `0.15` |

**Available Voices:**

| Male | Female |
|------|--------|
| `en-US-ChristopherNeural` | `en-US-JennyNeural` |
| `en-US-EricNeural` | `en-US-AriaNeural` |
| `en-US-GuyNeural` | `en-US-SaraNeural` |

### 📁 Project Structure

```
clickcast-clone/
├── server.js          # Web server
├── pipeline.js        # Main pipeline
├── capture.js         # Playwright screenshot
├── ai-agent.js        # AI analysis module
├── generate-script.js # Script generation
├── generate-audio.js  # TTS voiceover
├── build-timeline.js  # Timeline generation
├── src/               # Remotion video components
├── public/            # Static assets (BGM, etc.)
└── websites/          # Website-specific data
    └── {domain}/
        ├── public/    # Screenshots, audio, etc.
        └── out/       # Output videos
```

### 🚢 Deployment

Supports Docker deployment to Render, Railway, Fly.io, etc.

See [Dockerfile](./Dockerfile) and [render.yaml](./render.yaml).

### 📝 Notes

- Requires Node.js 18+ and Python 3
- API costs: DeepSeek ~¥1/video, GPT-4o ~$0.02/video
- Some websites may block automated screenshots

---

## License

MIT