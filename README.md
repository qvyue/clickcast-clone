# VidGen - AI Website to Video Generator

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
- 🎙️ **自动配音** - edge-TTS 高质量语音合成，可选 ElevenLabs 专业配音
- 🎵 **智能配乐** - AI 分析内容情绪，自动匹配最佳背景音乐
- 🎨 **主题适配** - 根据网站主色调自动调整视频配色
- 📱 **多比例支持** - 横屏 16:9 / 竖屏 9:16
- ☁️ **云存储** - 支持 Cloudflare R2 自动上传
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
# AI 配置 (必填)
DEEPSEEK_API_KEY=your_api_key_here
API_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat

# TTS 配音配置 (可选 - 升级 ElevenLabs 高质量配音)
ELEVENLABS_API_KEY=your_elevenlabs_key

# 云存储配置 (可选 - Cloudflare R2)
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket
R2_PUBLIC_URL=https://your-domain.com

# 其他配置
VOICE=en-US-ChristopherNeural
BGM_VOLUME=0.15
```

> 获取 DeepSeek API Key: https://platform.deepseek.com
> 获取 ElevenLabs API Key: https://elevenlabs.io

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

### 🎙️ 配音选项

#### edge-TTS (默认，免费)

```env
VOICE=en-US-ChristopherNeural
```

| 男声 | 女声 |
|------|------|
| `en-US-ChristopherNeural` | `en-US-JennyNeural` |
| `en-US-EricNeural` | `en-US-AriaNeural` |
| `en-US-GuyNeural` | `en-US-SaraNeural` |

#### ElevenLabs (可选，高质量)

配置 `ELEVENLABS_API_KEY` 和 `ELEVENLABS_VOICE_ID` 后启用。

默认声音：`alFofuDn3cOwyoz1i44T` (Dallin)
获取更多声音 ID：访问 [ElevenLabs Voice Library](https://elevenlabs.io/voice-library)

### 🎵 智能配乐

AI 分析网站内容和情绪，自动选择最佳背景音乐：

| 风格 | 适用场景 |
|------|----------|
| tech | 科技产品、SaaS、开发工具 |
| corporate | 企业官网、商业服务 |
| ecommerce | 电商、购物、促销 |
| creative | 创意作品、设计、艺术 |
| utility | 效率工具、生产力应用 |
| storytelling | 博客、故事、文章 |

### ☁️ 云存储 (R2)

配置 Cloudflare R2 后，生成的视频会自动上传到云端：

1. 在 Cloudflare 创建 R2 存储桶
2. 配置环境变量 (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID` 等)
3. 视频生成后自动上传，返回公开访问 URL

### 🎨 命令行使用

```bash
# 横屏视频 (1920x1080)
node bin/cli.js "https://stripe.com" landscape

# 竖屏视频 (1080x1920)
node bin/cli.js "https://stripe.com" portrait

# 预览视频
npm start

# 渲染输出
npm run render-landscape  # 横屏
npm run render-portrait   # 竖屏
```

### ⚙️ 配置选项

| 配置项 | 说明 | 必填 | 默认值 |
|--------|------|------|--------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key | ✅ | - |
| `API_BASE_URL` | API 地址 | | `https://api.deepseek.com` |
| `AI_MODEL` | AI 模型 | | `deepseek-chat` |
| `VOICE` | edge-TTS 配音声音 | | `en-US-ChristopherNeural` |
| `ELEVENLABS_API_KEY` | ElevenLabs API Key | | - |
| `BGM_VOLUME` | 背景音乐音量 | | `0.15` |
| `R2_ENDPOINT` | R2 存储端点 | | - |
| `R2_ACCESS_KEY_ID` | R2 访问密钥 ID | | - |
| `R2_SECRET_ACCESS_KEY` | R2 访问密钥 | | - |
| `R2_BUCKET_NAME` | R2 存储桶名称 | | - |
| `R2_PUBLIC_URL` | R2 公开访问 URL | | - |

### 📁 项目结构

```
clickcast-clone/
├── bin/                     # 入口脚本
│   ├── server.js            # Web 服务器
│   └── cli.js               # CLI 入口
├── lib/                     # 核心库模块
│   ├── capture.js           # Playwright 截图
│   ├── ai-agent.js          # AI Agent 核心模块
│   ├── ai-analyze.js        # AI 内容分析
│   ├── style-generator.js   # 样式生成
│   ├── video-styles.js      # 视频样式配置
│   ├── elevenlabs-tts.js    # ElevenLabs TTS 模块
│   ├── bgm-selector.js      # AI BGM 智能选择
│   ├── industry-research.js # 行业研究
│   └── r2-storage.js        # Cloudflare R2 存储
├── tools/                   # 独立工具脚本
│   ├── generate-audio.js    # TTS 配音
│   ├── generate-script.js   # 文案生成
│   ├── build-timeline.js    # 时间轴生成
│   ├── evaluate.js          # 视频评估
│   ├── video-quality-checker.js
│   └── preview.js           # 预览生成
├── utils/                   # 工具模块
│   ├── ai-client.js         # AI 客户端
│   ├── color.js             # 颜色处理
│   ├── domain.js            # 域名工具
│   └── env.js               # 环境变量
├── src/                     # Remotion 视频组件
│   ├── VidGenVideo.tsx
│   ├── VidGenScene.tsx
│   └── Root.tsx
├── public/                  # 静态资源（BGM 等）
└── websites/                # 网站专属数据
    └── {domain}/
        ├── public/          # 截图、配音等
        └── out/             # 输出视频
```

### 🚢 部署

支持 Docker 部署到 Render、Railway、Fly.io 等平台。

详见 [Dockerfile](./Dockerfile) 和 [render.yaml](./render.yaml)。

### 📝 注意事项

- 需要 Node.js 18+
- API 费用：DeepSeek 约 ¥1/次，GPT-4o 约 $0.02/次
- ElevenLabs 配音费用：约 $0.18/分钟
- 部分网站有反爬虫，可能需要手动截图

---

## English

### ✨ Features

- 🎯 **One-click generation** - Enter URL, auto screenshot, analyze, generate video
- 📦 **DOM Element Screenshot** - AI selects best sections, precise capture with pixel-perfect edges
- 🤖 **AI Powered** - Smart content analysis with DeepSeek/GPT-4
- 🎙️ **Auto Voiceover** - High-quality TTS with edge-TTS, optional ElevenLabs professional voice
- 🎵 **Smart BGM** - AI analyzes content mood and auto-matches best background music
- 🎨 **Theme Adaptation** - Auto-adjust video colors based on website theme
- 📱 **Multi-ratio** - Landscape 16:9 / Portrait 9:16
- ☁️ **Cloud Storage** - Auto-upload to Cloudflare R2
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
# AI Config (Required)
DEEPSEEK_API_KEY=your_api_key_here
API_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat

# TTS Voice (Optional - ElevenLabs premium voice)
ELEVENLABS_API_KEY=your_elevenlabs_key

# Cloud Storage (Optional - Cloudflare R2)
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket
R2_PUBLIC_URL=https://your-domain.com

# Other
VOICE=en-US-ChristopherNeural
BGM_VOLUME=0.15
```

> Get DeepSeek API Key: https://platform.deepseek.com
> Get ElevenLabs API Key: https://elevenlabs.io

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

### 🎙️ Voice Options

#### edge-TTS (Default, Free)

```env
VOICE=en-US-ChristopherNeural
```

| Male | Female |
|------|--------|
| `en-US-ChristopherNeural` | `en-US-JennyNeural` |
| `en-US-EricNeural` | `en-US-AriaNeural` |
| `en-US-GuyNeural` | `en-US-SaraNeural` |

#### ElevenLabs (Optional, Premium)

Set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` to enable.

Default voice: `alFofuDn3cOwyoz1i44T` (Dallin)
Find more voice IDs: [ElevenLabs Voice Library](https://elevenlabs.io/voice-library)

### 🎵 Smart BGM

AI analyzes website content and mood to select best background music:

| Style | Use Case |
|-------|----------|
| tech | Tech products, SaaS, dev tools |
| corporate | Corporate sites, business services |
| ecommerce | E-commerce, shopping, promotions |
| creative | Portfolios, design, art |
| utility | Productivity tools, efficiency apps |
| storytelling | Blogs, stories, articles |

### ☁️ Cloud Storage (R2)

Configure Cloudflare R2 to auto-upload generated videos:

1. Create R2 bucket in Cloudflare
2. Set environment variables (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, etc.)
3. Videos auto-upload after generation, return public URL

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

| Option | Description | Required | Default |
|--------|-------------|----------|---------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key | ✅ | - |
| `API_BASE_URL` | API URL | | `https://api.deepseek.com` |
| `AI_MODEL` | AI Model | | `deepseek-chat` |
| `VOICE` | edge-TTS voice | | `en-US-ChristopherNeural` |
| `ELEVENLABS_API_KEY` | ElevenLabs API Key | | - |
| `BGM_VOLUME` | Background music volume | | `0.15` |
| `R2_ENDPOINT` | R2 storage endpoint | | - |
| `R2_ACCESS_KEY_ID` | R2 access key ID | | - |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | | - |
| `R2_BUCKET_NAME` | R2 bucket name | | - |
| `R2_PUBLIC_URL` | R2 public URL | | - |

### 📁 Project Structure

```
clickcast-clone/
├── bin/                     # Entry scripts
│   ├── server.js            # Web server
│   └── cli.js               # CLI entry
├── lib/                     # Core library modules
│   ├── capture.js           # Playwright screenshot
│   ├── ai-agent.js          # AI Agent core module
│   ├── ai-analyze.js        # AI content analysis
│   ├── style-generator.js   # Style generation
│   ├── video-styles.js      # Video style config
│   ├── elevenlabs-tts.js    # ElevenLabs TTS module
│   ├── bgm-selector.js      # AI BGM smart selection
│   ├── industry-research.js # Industry research
│   └── r2-storage.js        # Cloudflare R2 storage
├── tools/                   # Standalone tool scripts
│   ├── generate-audio.js    # TTS voiceover
│   ├── generate-script.js   # Script generation
│   ├── build-timeline.js    # Timeline generation
│   ├── evaluate.js          # Video evaluation
│   ├── video-quality-checker.js
│   └── preview.js           # Preview generation
├── utils/                   # Utility modules
│   ├── ai-client.js         # AI client
│   ├── color.js             # Color utilities
│   ├── domain.js            # Domain utilities
│   └── env.js               # Environment
├── src/                     # Remotion video components
│   ├── VidGenVideo.tsx
│   ├── VidGenScene.tsx
│   └── Root.tsx
├── public/                  # Static assets (BGM, etc.)
└── websites/                # Website-specific data
    └── {domain}/
        ├── public/          # Screenshots, audio, etc.
        └── out/             # Output videos
```

### 🚢 Deployment

Supports Docker deployment to Render, Railway, Fly.io, etc.

See [Dockerfile](./Dockerfile) and [render.yaml](./render.yaml).

### 📝 Notes

- Requires Node.js 18+
- API costs: DeepSeek ~¥1/video, GPT-4o ~$0.02/video
- ElevenLabs voiceover: ~$0.18/minute
- Some websites may block automated screenshots

---

## License

MIT
