/**
 * DynamicScene 组件
 * 功能：渲染单个视频场景，处理图片展示、文字动画、音频播放
 *
 * 支持特性：
 * - 长图自动滚动动画（scrollImage 或 imageHeight/imageWidth > 1.2 触发）
 * - 两阶段音频（主配音 + 次配音，通过 mainDuration/subDuration 配置）
 * - Ken Burns 缓慢放大效果（非长图场景）
 * - Intro/Outro 特殊场景的 3D 旋转入场动画
 *
 * 场景类型：
 * - intro: 开场场景，带 "INTRODUCING" 标签和标题动画
 * - outro: 结尾场景，带 CTA 按钮和结束语
 * - 普通: 全屏图片背景 + 底部文字层
 */
import React from 'react';
import {
  AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Sequence, Img, Audio,
} from 'remotion';
import { Scene } from '../types';
import {
  hexToRgba, getContrastText, getButtonTextColor, isHighContrastGradient
} from './utils';

/**
 * DynamicScene 组件属性
 * @param sceneData - 场景数据，包含标题、副标题、图片、音频等配置
 * @param colors - 配色方案，包含 primary/secondary/accent/background/text 五种颜色
 * @param imageBaseUrl - 图片资源基础 URL
 * @param audioBaseUrl - 音频资源基础 URL
 */
interface DynamicSceneProps {
  sceneData: Scene;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  imageBaseUrl: string;
  audioBaseUrl: string;
}

export const DynamicScene: React.FC<DynamicSceneProps> = ({ sceneData, colors, imageBaseUrl, audioBaseUrl }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isPortrait = height > width;

  // ========== 文字颜色计算 ==========
  // 根据背景亮度自动选择黑/白文字，确保可读性
  const bgColor = colors.background || '#05010d';
  const textColor = getContrastText(bgColor);
  const subTextColor = textColor === '#FFFFFF' ? '#a1a1aa' : '#666666';
  const buttonTextColor = getButtonTextColor(colors.primary, colors.secondary);
  const isHighContrast = isHighContrastGradient(colors.primary, colors.secondary);

  // 高对比度渐变（如黑白渐变）需要特殊文字阴影处理
  const buttonTextStyle = isHighContrast
    ? { textShadow: '2px 2px 4px rgba(0,0,0,0.5), -1px -1px 2px rgba(255,255,255,0.3)' }
    : {};

  // ========== 入场动画 ==========
  /**
   * spring 弹簧动画
   * - frame - 5: 从第 5 帧开始动画，留出 5 帧延迟
   * - damping: 14: 阻尼系数，值越大振荡越少，动画越平稳
   * - 返回值: 0~1 的渐变值，用于控制透明度、位移、缩放等
   */
  const enter = spring({ frame: frame - 5, fps, config: { damping: 12, mass: 1.2, stiffness: 80 } });

  // ========== 退场动画 ==========
  /**
   * interpolate 线性插值
   * - 在最后 15 帧内从 1 渐变到 0（淡出效果）
   * - extrapolateRight: 'clamp' 确保超出范围时值不会继续变化
   */
  const duration = sceneData.durationInFrames ?? 300;
  const fadeOut = interpolate(frame, [duration - 15, duration], [1, 0], { extrapolateRight: 'clamp' });

  // 渐黑遮罩：场景最后15帧从透明渐变到背景色，避免退场露出底层渐变
  const fadeOverlay = interpolate(frame, [duration - 15, duration], [0, 1], { extrapolateRight: 'clamp' });

  // ========== 布局计算 ==========
  const layout = sceneData.layout;
  // 竖版模式强制居中，横版根据 layout 配置决定
  const isCenterMode = isPortrait ? true : layout === 'center';

  // ========== 长图检测与滚动动画 ==========
  /**
   * 长图检测条件（满足任一即可）：
   * 1. scrollImage === true: 显式标记为长图
   * 2. imageHeight / imageWidth > 1.2: 图片高宽比超过 1.2
   *
   * 滚动逻辑：
   * - 视频比例 16:9，底部文字栏约占 25% 高度
   * - 从顶部开始滚动，底部留约 35% 空间（文字栏 + 缓冲区）
   */
  const scrollImage = sceneData.scrollImage;
  const imageWidth = sceneData.imageWidth;
  const imageHeight = sceneData.imageHeight;
  const isLongImage = scrollImage === true || (imageWidth && imageHeight && (imageHeight / imageWidth > 1.2));

  // 滚动范围：从 0%（顶部）滚动到 65%（底部留 35%）
  const scrollStart = 0; // 起始位置：顶部
  const scrollEnd = isLongImage ? 65 : 0; // 结束位置：65%（长图场景）

  /**
   * 滚动进度计算（缓动效果）
   * - 关键帧分布：[0, 20%, 80%, 100%] 时间点
   * - [0, 20%]: 停留在顶部，让观众看清开头
   * - [20%, 80%]: 从顶部滚动到 65%
   * - [80%, 100%]: 停留在 65%，让观众看清结尾
   *
   * 这种"慢-快-慢"的缓动曲线，模拟 ease-in-out 效果
   */
  const scrollProgress = isLongImage
    ? interpolate(
        frame,
        [0, duration * 0.2, duration * 0.8, duration], // 关键帧时间点
        [scrollStart, scrollStart, scrollEnd, scrollEnd], // 对应的滚动位置
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      )
    : 0;

  /**
   * Ken Burns 缓慢放大效果
   * - 仅用于非长图场景（长图场景已有滚动动画，避免双重动态效果）
   * - 从 scale(1) 到 scale(1.08)，营造缓慢推进的视觉动感
   */
  const slowZoom = isLongImage ? 1 : interpolate(frame, [0, duration], [1, 1.08]);

  // ========== 文字尺寸计算 ==========
  // 根据文本长度动态调整字号，避免文字溢出
  const titleLength = (sceneData.mainTitle || '').length;
  const subTextLength = (sceneData.subTitle || '').length;
  const totalTextLength = titleLength + subTextLength;
  const isLongText = totalTextLength > 80;

  // ========== Intro/Outro 特殊场景 ==========
  /**
   * Intro/Outro 场景支持两阶段动画：
   * - Phase 1: 显示 mainTitle + 播放 audioFile（主配音）
   * - Phase 2: 显示 subTitle + 播放 audioFileSub（副配音）
   * - 无 subAudio 时：同时显示 mainTitle + subTitle，只播放主配音
   *
   * 与后端 src/ClickCastVideo.tsx (VidGenVideo) 的逻辑保持一致
   */
  if (sceneData.id === 'intro' || sceneData.id === 'outro') {
    const scale = interpolate(enter, [0, 1], [2, 1]);
    const rotateX = interpolate(enter, [0, 1], [25, 0]);
    const isIntro = sceneData.id === 'intro';
    const subTextLen = (sceneData.subTitle || '').length;
    const subTextSize = subTextLen > 100 ? '24px' : (subTextLen > 60 ? '28px' : '30px');

    // 两阶段音频检测
    const hasSubAudio = sceneData.audioFileSub && sceneData.subDuration;
    const mainDur = hasSubAudio ? Math.round((sceneData.mainDuration || 3) * fps) : duration;
    const subDur = hasSubAudio ? Math.round((sceneData.subDuration || 0) * fps) : 0;
    const transitionDur = Math.round((sceneData.transitionDuration ?? 0.5) * fps);

    // 阶段判断
    const isPhase1 = frame < mainDur;
    const isTransition = hasSubAudio && frame >= mainDur && frame < mainDur + transitionDur;
    const isPhase2 = hasSubAudio && frame >= mainDur + transitionDur;

    // Phase 2 淡出
    const fadeOutPhase2 = hasSubAudio && isPhase2
      ? interpolate(frame - mainDur - transitionDur, [subDur - fps * 0.5, subDur], [1, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
      : fadeOut;
    const currentOpacity = isPhase2 ? fadeOutPhase2 : fadeOut;

    return (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', perspective: '1000px', padding: isPortrait ? '0 40px' : '0 80px', opacity: currentOpacity }}>
        {/* Phase 1: 主配音 */}
        {isPhase1 && sceneData.audioFile && sceneData.audioFile.trim() !== '' && (
          <Sequence from={sceneData.audioStartFrame ?? 0}>
            <Audio src={`${audioBaseUrl}/${sceneData.audioFile}`} />
          </Sequence>
        )}
        {/* Phase 2: 副配音 */}
        {isPhase2 && sceneData.audioFileSub && sceneData.audioFileSub.trim() !== '' && (
          <Sequence from={(sceneData.audioStartFrame ?? 0) + mainDur + transitionDur} durationInFrames={subDur}>
            <Audio src={`${audioBaseUrl}/${sceneData.audioFileSub}`} />
          </Sequence>
        )}
        {/* 主内容容器：应用 3D 变换 */}
        <div style={{ transform: `scale(${scale}) rotateX(${rotateX}deg)`, textAlign: 'center', maxWidth: isPortrait ? '95%' : '1300px', width: '100%' }}>
          {/* Phase 1: 显示 mainTitle */}
          {(isPhase1 || isTransition || !hasSubAudio) && (
            <>
              {isIntro && (
                <div style={{
                  background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`,
                  padding: '8px 24px', borderRadius: '50px', display: 'inline-block',
                  fontSize: isPortrait ? '24px' : '20px', fontWeight: 800, letterSpacing: '2px',
                  marginBottom: '30px', boxShadow: `0 0 20px ${hexToRgba(colors.primary, 0.5)}`,
                  color: buttonTextColor, ...buttonTextStyle
                }}>INTRODUCING</div>
              )}
              <h1 style={{
                fontSize: isPortrait ? '90px' : (isIntro ? '90px' : '80px'),
                lineHeight: isPortrait ? '1.1' : 'normal', margin: '0 0 20px 0',
                color: textColor, fontWeight: 800
              }}>{sceneData.mainTitle}</h1>
              {/* 无两阶段时，同时显示副标题 */}
              {!hasSubAudio && isIntro && sceneData.subTitle && (
                <p style={{
                  fontSize: isPortrait ? '40px' : '30px', color: subTextColor,
                  marginTop: '30px', maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto',
                  lineHeight: 1.4, wordWrap: 'break-word', whiteSpace: 'pre-wrap'
                }}>{sceneData.subTitle}</p>
              )}
              {!hasSubAudio && !isIntro && (
                <>
                  <div style={{
                    background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`,
                    padding: '20px 50px', borderRadius: '12px', display: 'inline-block',
                    fontSize: '30px', fontWeight: 'bold', color: buttonTextColor,
                    letterSpacing: '1px', boxShadow: `0 10px 30px ${hexToRgba(colors.primary, 0.4)}`,
                    marginTop: '20px', ...buttonTextStyle
                  }}>GET STARTED</div>
                  {sceneData.subTitle && (
                    <p style={{
                      color: subTextColor, fontSize: subTextSize, marginTop: '40px',
                      maxWidth: '1100px', marginLeft: 'auto', marginRight: 'auto',
                      lineHeight: 1.4, wordWrap: 'break-word', whiteSpace: 'pre-wrap'
                    }}>{sceneData.subTitle}</p>
                  )}
                </>
              )}
            </>
          )}
          {/* Phase 2: 显示 subTitle */}
          {isPhase2 && (
            <h1 style={{
              fontSize: isPortrait ? '50px' : '40px',
              lineHeight: isPortrait ? '1.1' : 'normal', margin: '0 0 20px 0',
              color: textColor, fontWeight: 800
            }}>{sceneData.subTitle}</h1>
          )}
        </div>
      </AbsoluteFill>
    );
  }

  // ========== 普通场景（图片展示 + 文字说明） ==========
  /**
   * 两阶段音频检测
   * - audioFileSub + subDuration 存在时启用两阶段模式
   * - mainDuration: 主配音时长（秒）
   * - subDuration: 次配音时长（秒）
   * - transitionDuration: 过渡时长（秒，默认 0.5）
   *
   * 时间轴：
   * [主音频播放] → [过渡空白] → [次音频播放]
   */
  const hasTwoPhaseAudio = sceneData.audioFileSub && sceneData.subDuration;
  const mainAudioDuration = sceneData.mainDuration ? Math.round(sceneData.mainDuration * fps) : duration;
  const subAudioDuration = sceneData.subDuration ? Math.round(sceneData.subDuration * fps) : 0;
  const transitionFrames = Math.round((sceneData.transitionDuration ?? 0.5) * fps);

  return (
    <AbsoluteFill>
      {/* ========== 音频层 ========== */}

      {/* 主音频：如果有两阶段，则限制播放时长为 mainAudioDuration */}
      {sceneData.audioFile && sceneData.audioFile.trim() !== '' && (
        <Sequence from={sceneData.audioStartFrame ?? 0} durationInFrames={hasTwoPhaseAudio ? mainAudioDuration : undefined}>
          <Audio src={`${audioBaseUrl}/${sceneData.audioFile}?v=${sceneData.mainDuration || 0}`} />
        </Sequence>
      )}

      {/* 次音频：在主音频结束后 + 过渡帧数后开始播放 */}
      {hasTwoPhaseAudio && sceneData.audioFileSub && sceneData.audioFileSub.trim() !== '' && (
        <Sequence from={(sceneData.audioStartFrame ?? 0) + mainAudioDuration + transitionFrames} durationInFrames={subAudioDuration}>
          <Audio src={`${audioBaseUrl}/${sceneData.audioFileSub}?v=${sceneData.subDuration || 0}`} />
        </Sequence>
      )}

      {/* ========== 全屏图片背景层 ========== */}
      {sceneData.img && (
        <AbsoluteFill style={{
          overflow: 'hidden',
          backgroundColor: '#0a0a0a',
        }}>
          <Img
            src={`${imageBaseUrl}/${sceneData.img}`}
            style={{
              width: '100%',
              height: '100%',
              // 长图使用 cover 填充，普通图使用 contain 保持比例
              objectFit: isLongImage ? 'cover' : 'contain',
              // 长图使用滚动位置控制 objectPosition，普通图居中
              objectPosition: isLongImage
                ? `center ${scrollProgress}%`
                : 'center',
              // Ken Burns 缩放效果（仅非长图）
              transform: isLongImage ? 'none' : `scale(${slowZoom})`,
            }}
          />
        </AbsoluteFill>
      )}

      {/* ========== 底部文字层 ========== */}
      <AbsoluteFill style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
      }}>
        <div style={{
          width: '100%',
          padding: isPortrait ? '60px 40px 40px 40px' : '80px 40px 50px 40px',
          // 文字入场动画：透明度 + 上移
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [30, 0])}px)`,
        }}>
          <div style={{
            width: '100%',
            margin: '0 auto',
            textAlign: isCenterMode ? 'center' : 'left',
          }}>
            {/* 主标题 */}
            {!sceneData.hideTitle && (
              <h2 style={{
                fontSize: isPortrait ? '42px' : (isLongText ? '48px' : '56px'),
                lineHeight: 1.2,
                color: '#ffffff',
                margin: '0 0 12px 0',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                // 多层阴影增强文字可读性（在图片上显示时）
                textShadow: `
                  0 2px 4px rgba(0,0,0,0.8),
                  0 4px 8px rgba(0,0,0,0.6),
                  0 8px 16px rgba(0,0,0,0.4)
                `,
              }}>{sceneData.mainTitle}</h2>
            )}
            {/* 副标题 */}
            {sceneData.subTitle && (
              <p style={{
                fontSize: isPortrait ? '22px' : '24px',
                lineHeight: 1.5,
                color: 'rgba(255,255,255,0.95)',
                margin: 0,
                textShadow: `
                  0 1px 3px rgba(0,0,0,0.8),
                  0 2px 6px rgba(0,0,0,0.5)
                `,
              }}>{sceneData.subTitle}</p>
            )}
          </div>
        </div>
      </AbsoluteFill>

      {/* 渐黑遮罩：退场时覆盖内容，避免露出底层渐变 */}
      <AbsoluteFill style={{ backgroundColor: bgColor, opacity: fadeOverlay }} />
    </AbsoluteFill>
  );
};
