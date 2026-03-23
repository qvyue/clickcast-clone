# 介绍视频生成详细流程

> 本文档详细说明 ClickCast 如何从 URL 自动生成带配音、配乐的营销视频

## 整体流程概览

```
URL → DOM注入探针 → AI挑选区块 → 精准截图 → AI分析 → 生成文案 → TTS配音 → Remotion渲染 → MP4视频
```

---

## 流程图

### 主流程

```mermaid
flowchart TD
    A[用户输入 URL] --> B[创建网站专属目录]
    B --> C[📸 步骤1: 截图]
    C --> D[🤖 步骤2: AI 分析]
    D --> E[🎤 步骤3: 生成配音]
    E --> F[⏱️ 步骤4: 生成时间轴]
    F --> G[🎵 步骤4.5: AI 选择 BGM]
    G --> H[🎬 步骤5: 渲染视频]
    H --> I[✅ 输出 MP4 视频]

    style A fill:#e1f5fe
    style I fill:#c8e6c9
```

---

## 详细步骤说明

### 步骤 1: 截图 (capture.js)

```mermaid
flowchart LR
    subgraph 截图流程
        A1[Playwright 启动浏览器] --> A2[注入 DOM 探针]
        A2 --> A3[遍历 DOM 标记区块]
        A3 --> A4[AI 智能挑选最佳区块]
        A4 --> A5[精准截图 shot1-N.png]
        A5 --> A6[抓取页面文字]
        A6 --> A7[保存 scraped.json]
    end
```

**详细说明：**

| 阶段 | 操作 | 输出 |
|------|------|------|
| 浏览器启动 | Playwright 无头浏览器访问 URL | - |
| DOM 注入 | 为大容器打上 `data-ai-id` 编号 | - |
| AI 智能挑选 | AI 根据页面内容决定截图数量 (3-8 张) | 区块列表 |
| 精准截图 | `element.screenshot()` 完美贴合边缘 | `shot1.png` ~ `shotN.png` |
| 内容抓取 | 提取页面标题、描述、核心文字 | `scraped.json` |

> **智能截图策略**：AI 会分析页面内容丰富程度，智能决定截图数量。内容丰富时可截取 8 张，内容较少时 3-4 张，确保每张截图都有语义价值。

---

### 步骤 2: AI 分析 (ai-agent.js + industry-research.js)

```mermaid
flowchart TD
    subgraph AI分析流程
        B1[读取 scraped.json] --> B2[行业研究<br/>联网搜索]
        B2 --> B3[AI Agent 分析]
        B3 --> B4[生成视频脚本]
        B3 --> B5[生成视频风格]
        B4 --> B6[script: 产品名/标语/场景]
        B5 --> B7[style: 主色调/强调色/渐变]
    end
```

**输出数据结构：**

```json
{
  "script": {
    "product": "产品名称",
    "tagline": "产品标语",
    "scenes": [
      { "title": "场景标题", "subText": "副标题", "screenshot": "shot1.png" }
    ]
  },
  "style": {
    "primary": "#3B82F6",
    "accent": "#10B981",
    "gradient": ["#1E3A8A", "#3B82F6"]
  }
}
```

---

### 步骤 3: 生成配音 (generate-audio.js)

```mermaid
flowchart LR
    subgraph 配音流程
        C1[准备场景文字] --> C2[调用 edge-TTS]
        C2 --> C3[生成 MP3 音频]
        C3 --> C4[ffprobe 获取时长]
        C4 --> C5[记录音频时长数组]
    end
```

**配音场景：**

| 场景 | 音频文件 | 内容 |
|------|----------|------|
| Intro | `intro.mp3` | `{产品名}. {场景标题}.` |
| Scene 1-N | `scene1.mp3` ~ `sceneN.mp3` | 场景标题 (与截图数量对应) |
| Outro | `outro.mp3` | `{产品名}. {标语}.` |

---

### 步骤 4: 生成时间轴 (build-timeline.js)

```mermaid
flowchart TD
    subgraph 时间轴生成
        D1[读取音频时长] --> D2[计算场景帧数]
        D2 --> D3[分配起始帧]
        D3 --> D4[生成 timeline.json]
    end

    D4 --> D5["scenes: [{id, title, img, audio, startFrame, duration}]"]
    D4 --> D6["totalFrames: 总帧数"]
    D4 --> D7["style: 视频风格"]
```

**时间轴计算逻辑：**

```
场景时长(帧) = (音频时长 + 0.5秒缓冲) × 30fps
起始帧 = 上一场景起始帧 + 上一场景时长
```

---

### 步骤 4.5: AI 选择背景音乐 (bgm-selector.js)

```mermaid
flowchart TD
    subgraph BGM选择
        E1[分析网站类型] --> E2[计算视频时长]
        E2 --> E3[AI 推荐音乐风格]
        E3 --> E4[匹配音乐库]
        E4 --> E5[生成 BGM 配置]
        E5 --> E6[更新 timeline.json]
    end
```

**BGM 配置示例：**

```json
{
  "bgm": {
    "file": "bensound-slowlife.mp3",
    "volume": 0.15,
    "fadeInFrames": 30,
    "fadeOutFrames": 60
  }
}
```

---

### 步骤 5: 渲染视频 (Remotion)

```mermaid
flowchart TD
    subgraph 渲染流程
        F1[备份根目录 public] --> F2[复制网站专属 public]
        F2 --> F3[恢复 BGM 文件]
        F3 --> F4[Remotion 渲染]
        F4 --> F5[输出 MP4]
        F5 --> F6[恢复原始 public]
    end
```

**渲染参数：**

| 比例 | 分辨率 | Composition ID | 输出文件 |
|------|--------|----------------|----------|
| 横屏 | 1920×1080 | `ClickCastPromo-Landscape` | `landscape.mp4` |
| 竖屏 | 1080×1920 | `ClickCastPromo-Portrait` | `portrait.mp4` |

---

## 完整数据流图

```mermaid
flowchart TB
    subgraph 输入
        URL[URL]
    end

    subgraph 步骤1-截图
        CAP[capture.js]
        SHOTS[shot1-N.png<br/>(AI决定数量)]
        SCRAPED[scraped.json]
    end

    subgraph 步骤2-AI分析
        IR[industry-research.js]
        AA[ai-agent.js]
        SCRIPT[script.json]
        STYLE[style.json]
    end

    subgraph 步骤3-配音
        TTS[edge-TTS]
        AUDIO[intro.mp3, scene1-N.mp3, outro.mp3]
        DURATION[音频时长数组]
    end

    subgraph 步骤4-时间轴
        BT[build-timeline.js]
        TL[timeline.json]
    end

    subgraph 步骤4.5-BGM
        BGM[bgm-selector.js]
        BGMCONF[bgm 配置]
    end

    subgraph 步骤5-渲染
        REM[Remotion]
        MP4[最终视频 MP4]
    end

    URL --> CAP
    CAP --> SHOTS
    CAP --> SCRAPED

    SCRAPED --> IR
    IR --> AA
    SHOTS --> AA
    AA --> SCRIPT
    AA --> STYLE

    SCRIPT --> TTS
    TTS --> AUDIO
    AUDIO --> DURATION

    SCRIPT --> BT
    DURATION --> BT
    STYLE --> BT
    BT --> TL

    TL --> BGM
    SCRAPED --> BGM
    BGM --> BGMCONF
    BGMCONF --> TL

    TL --> REM
    SHOTS --> REM
    AUDIO --> REM
    REM --> MP4
```

---

## 文件结构

```
websites/{domain}/
├── public/
│   ├── shot1.png          # AI 精选截图 (3-8张)
│   ├── shot2.png
│   ├── shot3.png
│   ├── ...                 # 根据页面内容决定数量
│   ├── scraped.json       # 抓取的页面内容
│   ├── intro.mp3          # 开场配音
│   ├── scene1.mp3         # 场景配音 (与截图数量对应)
│   ├── scene2.mp3
│   ├── ...                 # 每张截图对应一个场景配音
│   ├── outro.mp3          # 结尾配音
│   └── timeline.json      # 视频时间轴
└── out/
    ├── landscape.mp4      # 横屏视频
    └── portrait.mp4       # 竖屏视频
```

---

## 命令行使用

```bash
# 生成横屏视频 (1920x1080)
node pipeline.js "https://stripe.com" landscape

# 生成竖屏视频 (1080x1920)
node pipeline.js "https://stripe.com" portrait

# 预览视频
npm start

# 渲染输出
npm run render-landscape  # 横屏
npm run render-portrait   # 竖屏
```

---

## 关键配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key | (必填) |
| `API_BASE_URL` | API 地址 | `https://api.deepseek.com` |
| `AI_MODEL` | AI 模型 | `deepseek-chat` |
| `VOICE` | 配音声音 | `en-US-ChristopherNeural` |
| `BGM_VOLUME` | 背景音乐音量 | `0.15` |
| 截图数量 | AI 智能决定 | 3-8 张 |