# ClickCast Clone - AI Video Generator

**始终用中文回复我。**

## 项目概述

这是一个基于 **Remotion** 的 AI 视频生成工具，将产品截图自动转化为精美的宣传视频（16:9 横版 / 9:16 竖版）。

### 核心流程

```
用户上传截图 → AI 分析截图内容 → 自动生成文案 + 配音 → 渲染成视频
```

---

## 技术架构

### 核心文件

| 文件 | 作用 |
|------|------|
| `src/Root.tsx` | Remotion 入口，定义 ClickCastPromo-Landscape 和 Portrait 两个 Composition |
| `src/ClickCastVideo.tsx` | 主视频组件，处理场景编排、BGM、背景渲染 |
| `src/ClickCastScene.tsx` | 场景组件，处理具体的文字、图片动画 |
| `websites/*/public/timeline.json` | 每个网站独立的时间轴配置 |
| `ai-agent.js` | AI 分析截图、生成文案的 Agent |
| `pipeline.js` | 端到端渲染管线 |

### 渲染模式

- **Intro**: 全屏渐变背景 + 旋转飞入的标题动画 + 主副文案
- **中间场景**: 截图展示 + 标题 + 副标题 + 配音（支持单阶段/两阶段切换）
- **Outro**: CTA 按钮 + 结尾文案

---

## 配色系统

颜色从 `timeline.json` 的 `style.colors` 动态读取：

```json
{
  "primary": "#9b4dff",     // 主品牌色（渐变、按钮高亮）
  "secondary": "#6b21a8",   // 辅助色
  "accent": "#d480ff",      // 强调色
  "background": "#05010d",  // 背景色
  "text": "#ffffff"         // 文字色
}
```

### 颜色工具函数 (ClickCastVideo.tsx)

```typescript
hexToRgba(hex, alpha)           // hex → rgba 转换
getContrastText(bgHex)          // 根据背景自动选黑白文字
getButtonTextColor(primary, secondary)  // 按钮文字色（处理高对比渐变）
isHighContrastGradient(primary, secondary)  // 检测是否需要文字阴影
```

---

## 布局规则

### 布局类型 (sceneData.layout)

| 布局 | 横版表现 | 竖版表现 |
|------|----------|----------|
| `center` | 文字居中上方，图片居中下方 | 始终居中 |
| `left` | 左侧文字，右侧图片，Y轴旋转15° | 竖版统一居中 |
| `right` | 右侧文字，左侧图片，Y轴旋转-15° | 竖版统一居中 |

### 图片重要性 (sceneData.imageImportance)

影响图片尺寸决策：

| 重要性 | 横版图片宽度 |
|--------|-------------|
| `high` | 680-750px（保持较大） |
| `medium` | 620-700px（中等） |
| `low` | 550-620px（可缩小） |

### 文本长度影响

`totalTextLength > 80` → 长文本模式：字号缩小、行数限制、图片适当调大
`totalTextLength > 120` → 超长文本：进一步压缩布局

---

## 两阶段动画

支持在同一场景中自动切换主副文案：

```typescript
mainDuration     // 主配音时长（秒）
subDuration      // 次配音时长（秒）
transitionDuration  // 过渡时长（秒，默认0.5）
```

### 阶段表现

1. **Phase 1**: 主文案 + 小图（右下角）
2. **过渡**: 空白过渡，Phase 1 完全淡出
3. **Phase 2**: 次文案 + 大图（全景）

---

## 常见开发任务

### 调整动画效果

```typescript
// 修改入场动画 (src/ClickCastVideo.tsx)
const enter = spring({ frame: frame - 5, fps, config: { damping: 14 } });

// 修改旋转角度 (目标值)
const targetRotateY = isPortrait ? 8 : -8;  // 竖版固定±8°

// 修改退场动画
const fadeOut = interpolate(frame, [duration - 15, duration], [1, 0]);
```

### 添加新场景类型

在 `DynamicScene` 组件中添加：

```typescript
if (sceneData.id === 'new-scene-type') {
  // 新场景的渲染逻辑
}
```

### 修改图片裁切策略

```typescript
// 在 timeline.json 中设置
sceneData.imageFocus = 'top' | 'bottom' | 'left' | 'right' | 'center'
sceneData.imageFit = 'contain' | 'cover'
```

---

## 渲染命令

```bash
# 启动 Web 服务（首页）
npm run web

# 渲染视频
npm run render-landscape   # 1920x1080 横版
npm run render-portrait    # 1080x1920 竖版

# 输出位置
websites/_preview/out/landscape.mp4
websites/_preview/out/portrait.mp4
```

> **注意**: 不要使用 `npm start`（Remotion Studio），它会占用 3000 端口导致 Web 服务无法启动。

---

## 目录结构

```
clickcast-clone/
├── src/
│   ├── Root.tsx              # Remotion 入口
│   ├── ClickCastVideo.tsx     # 主视频组件
│   ├── ClickCastScene.tsx     # 场景组件
│   └── style.css             # 全局样式
├── public/
│   ├── scene0.mp3           # 场景音频
│   ├── scene1.mp3
│   ├── *.mp3                # BGM、背景音乐
│   └── favicon.ico
├── websites/
│   ├── clickcast.tech/      # 各网站独立配置
│   ├── anthropic.com/
│   ├── deepseek.com/
│   └── ...
├── out/                      # 渲染输出（旧）
├── utils/                    # 工具脚本
├── ai-agent.js              # AI Agent
└── pipeline.js              # 渲染管线
```

---

## 调试技巧

1. **启动服务**: `npm run web` 启动 Web 服务（http://localhost:3000）
2. **修改时间轴**: 编辑 `timeline.json` 后需重启 Web 服务
3. **前端开发**: 修改 `frontend/src/` 后需 `cd frontend && npm run build` 重新构建
4. **资源引用**: `public/` 目录文件用 `staticFile()` 引用
5. **截图资源**: 放在对应网站的 `public/` 目录，如 `websites/clickcast.tech/public/`
6. **音频资源**: 放在 `public/` 目录，引用时使用文件名即可

---

## 注意事项

- **竖版适配**: 竖版模式下所有布局统一居中，旋转角度固定为 ±8°
- **长文本处理**: 超长文本会自动限制行数并调整字号
- **高对比渐变**: 黑白等高对比渐变背景需要添加文字阴影
- **音频同步**: 两阶段场景的音频通过 `Sequence` 和 `audioStartFrame` 控制
