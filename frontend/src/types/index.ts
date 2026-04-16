/**
 * Website - 网站基本信息
 *
 * 表示一个已创建的网站项目，包含域名、状态和视频渲染情况
 */
export interface Website {
  /** 网站域名，如 "clickcast.tech" */
  domain: string;

  /** 创建时间，ISO 8601 格式字符串 */
  createdAt: string;

  /** 当前处理状态：已完成/处理中/失败 */
  status: 'completed' | 'processing' | 'failed';

  /** 是否已生成横版视频(16:9) */
  hasLandscape: boolean;

  /** 是否已生成竖版视频(9:16) */
  hasPortrait: boolean;
}

/**
 * ScrapedData - 网页爬取数据
 *
 * 从原始网站抓取的内容信息，用于AI分析和视频生成
 */
export interface ScrapedData {
  /** 原始网站URL */
  url: string;

  /** 网站标题 */
  title: string;

  /** 网站描述 */
  description: string;

  /** 产品名称 */
  product: string;

  /** 产品标语/口号 */
  tagline: string;

  /** 提取的主题颜色列表 */
  colors: string[];

  /** 内容块列表，包含页面各个区域的文本内容 */
  blocks: Array<{
    /** 内容块类型，如 "hero"、"feature" 等 */
    type: string;

    /** 内容块文本内容 */
    text: string;

    /** CSS选择器，用于定位元素 */
    selector: string;
  }>;
}

/**
 * Scene - 视频场景
 *
 * 表示视频中的一个独立场景片段，包含布局、文字、图片、配音等配置
 */
export interface Scene {
  /** 场景唯一标识符 */
  id: string;

  /** 布局类型：左图右文/居中/右图左文 */
  layout: 'left' | 'center' | 'right';

  /** 主标题文本 */
  title: string;

  /** 副标题/描述文本（可选） */
  subText?: string;

  /** 图片文件名（可选） */
  img?: string;

  /** 主配音文件名（可选） */
  audioFile?: string;

  /** 次配音文件名，用于两阶段动画（可选） */
  audioFileSub?: string;

  /** 主配音脚本文本（可选） */
  text?: string;

  /** 次配音脚本文本，用于两阶段动画（可选） */
  subVoiceover?: string;

  /** 场景起始帧号 */
  startFrame: number;

  /** 场景持续帧数 */
  durationInFrames: number;

  /** 音频开始播放的帧号偏移（可选） */
  audioStartFrame?: number;

  /** 图片适应方式：包含/覆盖 */
  imageFit?: 'contain' | 'cover';

  /** 图片焦点位置，用于裁切定位 */
  imageFocus?: 'top' | 'bottom' | 'left' | 'right' | 'center';

  /** 主配音时长（秒），用于两阶段动画 */
  mainDuration?: number;

  /** 次配音时长（秒），用于两阶段动画 */
  subDuration?: number;

  /** 两阶段之间的过渡时长（秒） */
  transitionDuration?: number;

  /** 是否启用图片滚动效果（用于长图） */
  scrollImage?: boolean;

  /** 图片显示宽度（像素） */
  imageWidth?: number;

  /** 图片显示高度（像素） */
  imageHeight?: number;

  /** 是否隐藏标题（用于特殊布局场景） */
  hideTitle?: boolean;
}

/**
 * VideoStyle - 视频样式配置
 *
 * 定义视频的视觉风格，包括配色方案和动画风格
 */
export interface VideoStyle {
  /** 样式名称 */
  name: string;

  /** 颜色配置 */
  colors: {
    /** 主品牌色，用于渐变、按钮等 */
    primary: string;

    /** 辅助色，用于渐变背景 */
    secondary: string;

    /** 强调色，用于高亮元素 */
    accent: string;

    /** 背景色 */
    background: string;

    /** 文字颜色 */
    text: string;
  };

  /** 动画配置 */
  animation: {
    /** 动画速度：slow/normal/fast */
    speed: string;

    /** 动画风格：如 smooth/bouncy 等 */
    style: string;
  };
}

/**
 * Timeline - 时间轴配置
 *
 * 视频的核心配置文件，定义了整个视频的结构、场景序列和样式
 */
export interface Timeline {
  /** 产品名称 */
  product: string;

  /** 产品标语 */
  tagline: string;

  /** 帧率（通常为30） */
  fps: number;

  /** 视频总帧数 */
  totalFrames: number;

  /** 场景列表 */
  scenes: Scene[];

  /** 视频样式配置 */
  style: VideoStyle;

  /** 背景音乐配置（可选） */
  bgm?: {
    /** 音乐文件名 */
    src: string;

    /** 音量（0-1） */
    volume: number;

    /** 是否循环播放（默认 true） */
    loop?: boolean;
  };
}

/**
 * AudioFile - 音频文件信息
 *
 * 表示一个音频文件的元数据
 */
export interface AudioFile {
  /** 文件名 */
  name: string;

  /** 时长（秒） */
  duration: number;

  /** 文件大小（字节，可选） */
  size?: number;
}

/**
 * WebsiteData - 网站详细数据
 *
 * 包含网站处理的完整状态和各步骤的详细信息
 */
export interface WebsiteData {
  /** 网站域名 */
  domain: string;

  /** 整体处理状态 */
  status: 'completed' | 'processing' | 'failed';

  /** 各处理步骤的状态和结果 */
  steps: {
    /** 截图步骤 */
    screenshot: {
      /** 步骤状态：待处理/已完成/失败 */
      status: 'pending' | 'completed' | 'failed';

      /** 生成的截图文件列表 */
      files: string[];

      /** 爬取的网站数据 */
      scraped: ScrapedData | null;
    };

    /** AI分析步骤 */
    analysis: {
      /** 步骤状态 */
      status: 'pending' | 'completed' | 'failed';

      /** 生成的脚本数据 */
      script: any;

      /** 提取的视频样式 */
      style: VideoStyle | null;
    };

    /** 配音生成步骤 */
    voiceover: {
      /** 步骤状态 */
      status: 'pending' | 'completed' | 'failed';

      /** 生成的音频文件列表 */
      files: AudioFile[];
    };

    /** 时间轴生成步骤 */
    timeline: {
      /** 步骤状态 */
      status: 'pending' | 'completed' | 'failed';

      /** 生成的时间轴数据 */
      data: Timeline | null;
    };

    /** 视频渲染步骤 */
    render: {
      /** 步骤状态 */
      status: 'pending' | 'completed' | 'failed';

      /** 生成的视频文件列表 */
      files: string[];
    };
  };
}

/**
 * StepId - 处理步骤标识符
 *
 * 用于标识视频生成的各个处理阶段
 */
export type StepId = 'screenshot' | 'analysis' | 'voiceover' | 'timeline' | 'preview';

/**
 * STEPS - 处理步骤配置
 *
 * 定义视频生成的标准处理流程，包含步骤ID、显示标签和图标
 */
export const STEPS: Array<{ id: StepId; label: string; icon: string }> = [
  { id: 'screenshot', label: 'Screenshot', icon: '📸' },      // 截图阶段
  { id: 'analysis', label: 'AI Analysis', icon: '🤖' },      // AI分析阶段
  { id: 'voiceover', label: 'Voiceover', icon: '🎙️' },      // 配音生成阶段
  { id: 'timeline', label: 'Timeline', icon: '⏱️' },         // 时间轴生成阶段
  { id: 'preview', label: 'Preview', icon: '🎬' },           // 预览渲染阶段
];
