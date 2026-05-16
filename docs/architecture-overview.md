# ClickCast Clone — 架构总览

> 生成时间：2026-04-28
> 维护者：Claude Code
> 用途：为 AI 开发助手提供项目上下文，加速代码理解和开发

---

## 1. 项目定位

**ClickCast** 是一个 AI 驱动的 SaaS 产品视频生成工具。

用户输入任意网站 URL → AI 分析截图 → 生成视频脚本 + 配音 + 时间轴配置 → Remotion 渲染最终视频。

典型输出：横版（1920×1080）或竖版（1080×1920）的产品介绍短视频，带有 AI 配音、动态场景动画和品牌配色。

---

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| 视频渲染 | Remotion（React 视频框架） |
| 前端 | React + TypeScript + Vite |
| 状态管理 | Zustand |
| AI 后端 | DeepSeek Chat API / OpenAI 兼容接口 |
| 配音 | Microsoft Edge TTS（免费高保真语音合成） |
| 截图采集 | Playwright |
| 媒体处理 | ffmpeg / ffprobe |
| 后端服务器 | Python 内置 http.server |
| 包管理 | npm / Node.js |

---

## 3. 目录结构

```
clickcast-clone/
├── frontend/                    # 现代前端（React + Vite）
│   ├── src/
│   │   ├── main.tsx            # Vite 入口
│   │   ├── App.tsx             # 根组件
│   │   ├── index.css           # 全局样式
│   │   ├── types/index.ts      # TypeScript 类型定义
│   │   ├── store/              # Zustand 状态管理
│   │   │   └── editorStore.ts  # 视频编辑器状态
│   │   ├── api/
│   │   │   └── client.ts        # 与 Python 后端通信
│   │   ├── components/Editor/   # 视频编辑器 UI 组件
│   │   │   ├── VideoEditor.tsx # 主编辑器界面
│   │   │   ├── SceneEditor.tsx # 场景编辑器
│   │   │   ├── Timeline.tsx     # 时间轴组件
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── ProgressIndicator.tsx
│   │   └── remotion/           # Remotion 视频组件
│   │       ├── DynamicScene.tsx  # 核心场景（两阶段动画）
│   │       ├── ClickCastVideo.tsx # 根视频组件
│   │       ├── Background.tsx   # 背景渲染
│   │       └── utils.ts          # 视频工具函数
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   └── dist/                   # 构建产物
├── tools/                      # AI 流水线脚本（Node.js）
│   ├── build-timeline.js       # 从 ai-script.json 生成 timeline.json
│   ├── generate-script.js      # AI Agent 生成视频脚本
│   ├── generate-audio.js       # Edge TTS 生成配音
│   ├── evaluate.js             # 效果评估系统
│   ├── preview.js              # 渲染前预览系统
│   └── video-quality-checker.js # 视频质量检查
├── utils/                      # 跨工具共享模块
│   ├── ai-client.js            # 统一 AI API 调用（DeepSeek/OpenAI）
│   ├── color.js                # 颜色处理工具（RGB/HSL 转换等）
│   ├── domain.js               # 域名解析工具
│   └── env.js                  # .env 环境变量加载
├── scripts/
│   ├── server.py               # Python HTTP 服务器（端口 3000）
│   ├── start.bat / start.sh    # 启动脚本
│   └── .env                    # 环境变量配置
├── websites/                   # 按网站划分的生成内容
│   └── <domain>/
│       └── public/
│           ├── timeline.json   # 视频时间轴配置（核心数据）
│           ├── screenshots/   # 截图
│           ├── audio/         # 配音文件
│           └── ai-script.json # AI 生成的原始脚本
├── public/                    # 共享静态资源
├── src/                       # 根目录旧版 Remotion（早期验证用）
│   ├── Root.tsx
│   ├── ClickCastVideo.tsx
│   └── ClickCastScene.tsx
├── remotion.config.ts         # Remotion 配置
├── CLAUDE.md                   # 本项目开发指引
└── docs/                       # 项目文档
```

---

## 4. 核心数据流

```
用户输入 URL
     │
     ▼
┌─────────────────────────────┐
│  capture.js (Playwright)    │  截图采集
│  → websites/<domain>/       │
│    public/scraped.json      │
└─────────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│  generate-script.js (AI)   │  AI Agent 分析 + 生成脚本
│  → public/ai-script.json   │
└─────────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│  generate-audio.js         │  Edge TTS 生成配音
│  → public/audio/           │
└─────────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│  build-timeline.js         │  构建 timeline.json
│  → public/timeline.json    │
└─────────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│  Remotion 渲染              │  输出 MP4 视频
│  → out/<output>.mp4         │
└─────────────────────────────┘
```

---

## 5. 核心文件详解

### 5.1 timeline.json — 视频时间轴配置（核心数据）

由 `build-timeline.js` 生成，Remotion 据此渲染每一帧。结构：

```json
{
  "videoType": "Landscape",       // 或 "Portrait"
  "style": "dark",
  "colorScheme": {
    "background": "#0f172a",
    "primary": "#6366f1",
    "text": "#ffffff",
    "secondary": "#94a3b8"
  },
  "title": "...",
  "scenes": [
    {
      "id": "intro",
      "startFrame": 0,
      "durationFrames": 30,
      "type": "intro",
      "text": "...",
      "layout": "center",
      "animation": "fadeIn"
    },
    {
      "id": "scene-1",
      "startFrame": 30,
      "durationFrames": 150,
      "type": "feature",
      "text": "...",
      "layout": "left",
      "imageIndex": 0,
      "animation": "slideInLeft"
    }
  ],
  "audio": {
    "voiceover": "public/audio/voiceover.mp3",
    "introMusic": "public/audio/intro.mp3"
  },
  "fps": 30
}
```

### 5.2 DynamicScene.tsx — 核心场景组件

主渲染组件，处理所有场景动画。关键逻辑：

- **单阶段模式**：直接渲染场景动画
- **两阶段模式**：Phase 1 背景动画 + Phase 2 叠加层动画
- **Intro / Outro**：独立分支，有各自的动画曲线
- **布局系统**：`center` | `left` | `right` 三种对齐
- **智能文字对比度**：根据背景色自动选择文字颜色（`getSmartTextColor`）

### 5.3 ai-client.js — AI 统一调用

提供 `callAI(messages, options)` 函数：
- 自动注入 `DEEPSEEK_API_KEY` / `OPENAI_API_KEY`
- 支持自定义 `API_BASE_URL` 和 `AI_MODEL`
- 自动清理 markdown 代码块，提取 JSON 响应

### 5.4 color.js — 颜色处理工具

- `rgbToHsl()` / `hslToRgb()`
- `hexToRgb()` / `rgbToHex()`
- `getContrastColor()` — 获取高对比度文字颜色
- `isColorDark()` — 判断颜色明暗

### 5.5 build-timeline.js — 时间轴构建

关键逻辑：
- 使用 `ffprobe` 读取音频时长
- 计算帧数：`Math.ceil(audioDuration * FPS)`
- 按 `AUDIO_START_DELAY` 帧偏移音频
- 生成带帧范围的 scenes 数组

---

## 6. Pipeline 步骤（server.py 定义）

| 步骤 | ID | 说明 |
|------|----|------|
| 📸 截图 | `capturing` | Playwright 访问网站并截图 |
| 🤖 AI 分析 | `analyzing` | 分析截图提取关键信息 |
| 📝 生成文案 | `script` | AI 生成视频脚本 |
| 🎤 配音 | `voiceover` | Edge TTS 语音合成 |
| ⏱️ 时间轴 | `timeline` | 生成视频时间轴配置 |
| 🎬 渲染 | `rendering` | Remotion 渲染视频 |

---

## 7. 开发命令

```bash
# 启动 Python 后端服务器
python scripts/server.py

# AI 流水线
node tools/generate-script.js   # 生成脚本
node tools/generate-audio.js    # 生成配音
node tools/build-timeline.js    # 构建时间轴

# 渲染
npx remotion preview           # 预览
npx remotion render LandingPage out/video.mp4  # 渲染

# 前端开发
cd frontend && npm run dev

# 评估
node tools/evaluate.js
node tools/video-quality-checker.js
```

---

## 8. 环境变量（.env）

```env
DEEPSEEK_API_KEY=sk-xxx       # AI API 密钥
OPENAI_API_KEY=sk-xxx         # 备用
API_BASE_URL=https://api.deepseek.com  # 或 https://api.openai.com
AI_MODEL=deepseek-chat        # 模型名称
VOICE=en-US-ChristopherNeural # Edge TTS 音色
```

---

## 9. 关键类型（frontend/src/types/index.ts）

- `VideoType`: `Landscape` | `Portrait`
- `Scene`: 场景配置（id, type, text, layout, animation 等）
- `TimelineConfig`: 完整时间轴配置
- `ColorScheme`: 配色方案
- `AnimationType`: 动画类型枚举

---

## 10. 注意事项

- **Windows 环境**：使用 `python` 而非 `python3`；ffmpeg/ffprobe 需在 PATH 中
- **多网站支持**：每个网站有独立的 `websites/<domain>/public/` 目录
- **渲染配置**：`remotion.config.ts` 在根目录；`fps: 30`
- **API 兼容**：ai-client.js 同时支持 DeepSeek 和 OpenAI 兼容接口
- **Edge TTS 免费**：无需 API Key，直接调用微软在线合成服务
- **测试输出**：`test-screenshots*/` 和 `out/` 目录包含历史渲染结果

---

*本文档由 Claude Code 自动生成，如有不准确之处请指正。*
