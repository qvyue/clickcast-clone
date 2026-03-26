// src/ClickCastVideo.tsx
import React from 'react';
import {
  AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Sequence, Img, staticFile, Audio,
} from 'remotion';

// 导入动态时间轴
import timeline from '../public/timeline.json';

// 从 timeline 获取样式配置
const videoStyle = (timeline as any).style || {
  colors: {
    primary: '#9b4dff',
    secondary: '#6b21a8',
    accent: '#d480ff',
    background: '#05010d',
    text: '#ffffff',
  }
};

// 将 hex 颜色转换为 rgba
function hexToRgba(hex: string, alpha: number = 1): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
  }
  return hex;
}

// 计算 object-position 值 (根据 AI 分析的焦点区域)
function getObjectPosition(focusArea: string): string {
  switch (focusArea) {
    case 'top': return 'center top';
    case 'bottom': return 'center bottom';
    case 'left': return 'left center';
    case 'right': return 'right center';
    case 'center':
    default: return 'center center';
  }
}

// 计算颜色亮度 (0-255)
function getLuminance(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 128;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  // 使用感知亮度公式
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// 根据背景颜色自动选择对比度最高的文字颜色
function getContrastText(bgHex: string): string {
  const luminance = getLuminance(bgHex);
  // 如果背景较暗，返回白色；如果背景较亮，返回黑色
  return luminance > 128 ? '#000000' : '#FFFFFF';
}

// 计算渐变背景的平均亮度，选择最佳文字颜色
function getButtonTextColor(primary: string, secondary: string): string {
  const lum1 = getLuminance(primary);
  const lum2 = getLuminance(secondary);
  const avgLuminance = (lum1 + lum2) / 2;

  // 高对比度渐变（如黑白渐变）使用深色文字配合阴影
  // 因为浅色文字在渐变的浅色部分不可见
  if (Math.abs(lum1 - lum2) > 200) {
    return '#000000'; // 深色文字 + 阴影可以在两端都可见
  }

  return avgLuminance > 128 ? '#000000' : '#FFFFFF';
}

// 检测是否是高对比度渐变（如黑白渐变），需要添加文字阴影
function isHighContrastGradient(primary: string, secondary: string): boolean {
  const lum1 = getLuminance(primary);
  const lum2 = getLuminance(secondary);
  // 如果两端亮度差距大于 200，就是高对比度渐变
  return Math.abs(lum1 - lum2) > 200;
}

// --- 1. 背景组件 (使用动态配色) ---
const Background: React.FC = () => {
  const { width, height } = useVideoConfig();
  const isPortrait = height > width;
  const colors = videoStyle.colors;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: isPortrait ? '10%' : '20%', left: isPortrait ? '10%' : '30%', width: isPortrait ? '80%' : '40%', height: '50%', background: `radial-gradient(circle, ${hexToRgba(colors.primary, 0.4)} 0%, rgba(0,0,0,0) 70%)`, filter: 'blur(80px)' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: isPortrait ? '-20%' : '10%', width: isPortrait ? '120%' : '50%', height: '60%', background: `radial-gradient(circle, ${hexToRgba(colors.secondary, 0.5)} 0%, rgba(0,0,0,0) 70%)`, filter: 'blur(100px)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: '-50%', width: '200%', height: isPortrait ? '30%' : '40%', backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px', transform: 'perspective(500px) rotateX(75deg) translateY(100px)', maskImage: 'linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0))', WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0))' }} />
    </AbsoluteFill>
  );
};

// --- 2. 统一的动态场景组件 ---
const DynamicScene: React.FC<{ sceneData: any }> = ({ sceneData }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isPortrait = height > width;
  const colors = videoStyle.colors;

  // 检查是否有两阶段动画数据
  const hasTwoPhase = sceneData.audioFileSub && sceneData.subDuration;
  // mainDuration 和 subDuration 在 timeline.json 中是秒，需要转换成帧数
  const mainDurationSec = sceneData.mainDuration || (sceneData.durationInFrames / fps);
  const subDurationSec = sceneData.subDuration || 0;
  // 转换成帧数（用于动画计算）
  const mainDuration = Math.round(mainDurationSec * fps);
  const subDuration = Math.round(subDurationSec * fps);
  // 主配音和次配音之间的过渡时间（帧数）
  const transitionDuration = Math.round((sceneData.transitionDuration || 0.5) * fps);

  // 根据背景颜色自动计算所有文字颜色，确保最佳对比度
  const bgColor = colors.background || '#05010d';
  const textColor = getContrastText(bgColor);  // 主标题颜色
  const subTextColor = textColor === '#FFFFFF' ? '#a1a1aa' : '#666666';  // 副标题颜色（略浅）
  const buttonTextColor = getButtonTextColor(colors.primary, colors.secondary);  // 按钮文字颜色

  // 高对比度渐变按钮需要文字阴影
  const isHighContrast = isHighContrastGradient(colors.primary, colors.secondary);
  const buttonTextStyle = isHighContrast
    ? { textShadow: '2px 2px 4px rgba(0,0,0,0.5), -1px -1px 2px rgba(255,255,255,0.3)' }
    : {};

  // 进场动画
  const enter = spring({ frame: frame - 5, fps, config: { damping: 14 } });

  // 动态退场动画
  const duration = sceneData.durationInFrames;
  const fadeOut = interpolate(frame, [duration - 15, duration], [1, 0], { extrapolateRight: 'clamp' });

  // 布局计算
  const layout = sceneData.layout;
  const isCenterMode = isPortrait ? true : layout === 'center';
  const targetRotateY = isPortrait ? (layout === 'left' ? 8 : -8) : (layout === 'center' ? 0 : (layout === 'left' ? -15 : 15));
  const rotateY = interpolate(enter, [0, 1], [targetRotateY > 0 ? 40 : -40, targetRotateY]);
  const translateY = interpolate(enter, [0, 1], [200, 0]);
  const slowZoom = interpolate(frame, [0, duration], [1, 1.05]);

  // Intro 和 Outro 样式 - 支持两阶段
  if (sceneData.id === 'intro' || sceneData.id === 'outro') {
    const scale = interpolate(enter, [0, 1], [3, 1]);
    const rotateX = interpolate(enter, [0, 1], [40, 0]);
    const isIntro = sceneData.id === 'intro';

    // 检查是否有次配音
    const hasSubAudio = sceneData.audioFileSub && sceneData.subDuration;
    const mainDur = hasSubAudio ? (sceneData.mainDuration || 3) * fps : duration;
    const subDur = hasSubAudio ? (sceneData.subDuration || 0) * fps : 0;
    const transitionDur = Math.round((sceneData.transitionDuration || 0.5) * fps);

    // 阶段判断
    const isPhase1 = frame < mainDur;
    const isTransition = hasSubAudio && frame >= mainDur && frame < mainDur + transitionDur;
    const isPhase2 = hasSubAudio && frame >= mainDur + transitionDur;

    // 阶段2淡出
    const fadeOutPhase2 = hasSubAudio && isPhase2
      ? interpolate(frame - mainDur - transitionDur, [subDur - fps * 0.5, subDur], [1, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
      : fadeOut;

    const currentOpacity = isPhase2 ? fadeOutPhase2 : fadeOut;

    return (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', perspective: '1000px', padding: isPortrait ? '0 40px' : '0', opacity: currentOpacity }}>
        {/* 阶段1: 主配音 */}
        {isPhase1 && (
          <Sequence from={sceneData.audioStartFrame}>
            <Audio src={staticFile(sceneData.audioFile)} />
          </Sequence>
        )}
        {/* 阶段2: 次配音 */}
        {isPhase2 && (
          <Sequence from={0}>
            <Audio src={staticFile(sceneData.audioFileSub)} />
          </Sequence>
        )}
        <div style={{ transform: `scale(${scale}) rotateX(${rotateX}deg)`, textAlign: 'center' }}>
          {isIntro ? (
            <div style={{ background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`, padding: '8px 24px', borderRadius: '50px', display: 'inline-block', fontSize: isPortrait ? '24px' : '20px', fontWeight: 800, letterSpacing: '2px', marginBottom: '30px', boxShadow: `0 0 20px ${hexToRgba(colors.primary, 0.5)}`, color: buttonTextColor, ...buttonTextStyle }}>INTRODUCING</div>
          ) : null}
          <h1 style={{ fontSize: isPortrait ? '90px' : (isIntro ? '90px' : '80px'), lineHeight: isPortrait ? '1.1' : 'normal', margin: '0 0 20px 0', color: textColor, fontWeight: 800 }}>{sceneData.title}</h1>

          {isIntro ? (
            <p style={{ fontSize: isPortrait ? '40px' : '30px', color: subTextColor, marginTop: '30px' }}>{sceneData.subText}</p>
          ) : (
            <>
              <div style={{ background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`, padding: '20px 50px', borderRadius: '12px', display: 'inline-block', fontSize: '30px', fontWeight: 'bold', color: buttonTextColor, letterSpacing: '1px', boxShadow: `0 10px 30px ${hexToRgba(colors.primary, 0.4)}`, marginTop: '20px', ...buttonTextStyle }}>GET STARTED</div>
              <p style={{ color: subTextColor, fontSize: '30px', marginTop: '40px' }}>{sceneData.subText}</p>
            </>
          )}
        </div>
      </AbsoluteFill>
    );
  }

  // 正常截图展示
  // 获取 AI 分析的裁切策略
  const imageFit = sceneData.imageFit || 'contain'; // 默认 contain 更安全
  const imageFocus = sceneData.imageFocus || 'center';
  const objectPosition = getObjectPosition(imageFocus);

  // AI 智能布局决策
  const imageImportance = sceneData.imageImportance || 'medium';
  const layoutReason = sceneData.layoutReason || '';

  // 计算文本长度，动态调整布局
  const titleLength = (sceneData.title || '').length;
  const subTextLength = (sceneData.subText || '').length;
  const totalTextLength = titleLength + subTextLength;

  // 根据文本长度和图片重要性智能调整
  const isLongText = totalTextLength > 80;
  const isVeryLongText = totalTextLength > 120;

  // 根据 AI 的布局决策 + 文本长度，动态调整图片尺寸
  // 规则：
  // - HIGH importance + long text → 图片保持较大（在 center 布局下）
  // - LOW importance + long text → 图片可以缩小
  // - HIGH importance + short text → 图片最大化
  // - MEDIUM importance → 中等尺寸

  let imageWidth: string;
  if (isCenterMode) {
    // Center 布局：图片独立于文字，保持较大
    imageWidth = isPortrait
      ? (isVeryLongText ? '800px' : (isLongText ? '880px' : '960px'))
      : (isLongText ? '800px' : '900px');
  } else {
    // Left/Right 布局：根据图片重要性和文字长度动态调整
    if (imageImportance === 'high') {
      // 高重要性图片：保持较大，但长文本时适当缩小
      imageWidth = isLongText ? '680px' : '750px';
    } else if (imageImportance === 'low') {
      // 低重要性图片：可以更小
      imageWidth = isLongText ? '550px' : '620px';
    } else {
      // 中等重要性
      imageWidth = isLongText ? '620px' : '700px';
    }
  }

  // 动态字体大小
  const titleFontSize = isPortrait
    ? (isVeryLongText ? '50px' : (isLongText ? '55px' : '70px'))
    : (isCenterMode ? (isLongText ? '40px' : '50px') : (isLongText ? '50px' : '65px'));
  const subTextFontSize = isPortrait
    ? (isVeryLongText ? '26px' : (isLongText ? '30px' : '35px'))
    : (isCenterMode ? (isLongText ? '24px' : '30px') : (isLongText ? '26px' : '30px'));

  // 动态间距
  const textMarginBottom = isCenterMode
    ? (isPortrait ? (isLongText ? '40px' : '80px') : (isLongText ? '30px' : '60px'))
    : '0';

  // 两阶段动画渲染函数
  const renderTwoPhaseScene = () => {
    // 阶段1: 主文案阶段 - 图片正常大小，标题显示
    const renderPhase1 = () => {
      const phase1Frame = frame;
      const enterPhase1 = spring({ frame: phase1Frame - 5, fps, config: { damping: 14 } });
      // 主文案阶段结束时淡出（在 mainDuration 结束前开始淡出）
      const fadeOutPhase1 = interpolate(phase1Frame, [mainDuration - 15, mainDuration], [1, 0], { extrapolateRight: 'clamp' });

      return (
        <AbsoluteFill style={{
          flexDirection: isCenterMode ? 'column' : (layout === 'left' ? 'row' : 'row-reverse'),
          justifyContent: 'center', alignItems: 'center',
          padding: isPortrait ? '0 40px' : (isCenterMode ? '100px' : '0 120px'),
          opacity: fadeOutPhase1, perspective: '1500px'
        }}>
          <Sequence from={sceneData.audioStartFrame}>
            <Audio src={staticFile(sceneData.audioFile)} />
          </Sequence>

          <div style={{
            flex: isPortrait ? 0 : 1,
            textAlign: isCenterMode ? 'center' : 'left',
            opacity: enterPhase1,
            transform: `translateY(${interpolate(enterPhase1,[0, 1], [50, 0])}px)`,
            marginBottom: textMarginBottom,
            padding: isCenterMode ? '0' : (layout === 'left' ? '0 60px 0 0' : '0 0 0 60px'),
            maxHeight: isPortrait ? '35%' : 'auto',
            overflow: 'hidden'
          }}>
            <h2 style={{
              fontSize: titleFontSize,
              lineHeight: isLongText ? 1.15 : 1.1,
              color: textColor,
              margin: '0 0 15px 0',
              textShadow: isLongText ? '0 2px 4px rgba(0,0,0,0.5)' : 'none'
            }}>{sceneData.title}</h2>
            {sceneData.subText && <p style={{
              fontSize: subTextFontSize,
              lineHeight: 1.3,
              color: subTextColor,
              margin: 0,
              display: isVeryLongText ? '-webkit-box' : 'block',
              WebkitLineClamp: isVeryLongText ? 3 : 'unset',
              WebkitBoxOrient: 'vertical',
              overflow: isVeryLongText ? 'hidden' : 'visible'
            }}>{sceneData.subText}</p>}
          </div>
          <div style={{ flex: isCenterMode ? 0 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ transform: `translateY(${interpolate(enterPhase1, [0, 1], [200, 0])}px) rotateY(${interpolate(enterPhase1, [0, 1], [targetRotateY > 0 ? 40 : -40, targetRotateY])}deg) scale(${interpolate(phase1Frame, [0, mainDuration], [1, 1.05])})`, boxShadow: `0 30px 60px rgba(0,0,0,0.6), 0 0 40px ${hexToRgba(colors.primary, 0.3)}`, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.15)', width: imageWidth, aspectRatio: '1440 / 900', overflow: 'hidden', background: '#111', flexShrink: 0 }}>
              <Img
                src={staticFile(sceneData.img)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: imageFit,
                  objectPosition: objectPosition
                }}
              />
            </div>
          </div>
        </AbsoluteFill>
      );
    };

    // 过渡阶段: 空白过渡，让 Phase 1 完全淡出，Phase 2 再淡入
    const renderTransition = () => {
      // 过渡阶段只显示背景，不显示图片
      // 这样 Phase 1 的图片会淡出，Phase 2 的图片会淡入
      return (
        <AbsoluteFill style={{
          justifyContent: 'center',
          alignItems: 'center',
          perspective: '1500px'
        }}>
          {/* 过渡期间不显示任何内容，让场景自然过渡 */}
        </AbsoluteFill>
      );
    };

    // 阶段2: 次文案阶段 - 大图淡入并放大显示
    const renderPhase2 = () => {
      const phase2Frame = frame - mainDuration - transitionDuration;

      // 图片淡入动画 - 开始时淡入
      const imageFadeIn = interpolate(phase2Frame, [0, fps * 0.3], [0, 1], { extrapolateRight: 'clamp' });

      // 图片放大动画
      const zoomProgress = spring({ frame: phase2Frame, fps, config: { damping: 20, stiffness: 100 } });
      const imageScale = interpolate(zoomProgress, [0, 1], [1.15, 1.25]);

      // 文字淡出动画
      const textOpacity = interpolate(phase2Frame, [0, fps * 0.5], [1, 0], { extrapolateRight: 'clamp' });

      // 场景结束时淡出
      const actualSubDuration = Math.max(subDuration, fps * 3);
      const fadeOutPhase2 = interpolate(phase2Frame, [actualSubDuration - fps * 0.5, actualSubDuration], [1, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

      // 根据布局决定图片的位置
      const imageJustifyContent = isCenterMode
        ? 'center'
        : (layout === 'left' ? 'flex-end' : 'flex-start');
      const transformOrigin = isCenterMode
        ? 'center center'
        : (layout === 'left' ? 'right center' : 'left center');

      // 计算大图尺寸
      const largeImageWidth = isPortrait ? '95%' : '85%';
      const largeImageHeight = isPortrait ? '55%' : '70%';

      return (
        <AbsoluteFill style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: isPortrait ? '0 20px' : '0 40px',
          perspective: '1500px'
        }}>
          <Sequence from={0}>
            <Audio src={staticFile(sceneData.audioFileSub)} />
          </Sequence>

          {/* 图片层 - 大图从原位置淡入并放大 */}
          <div style={{
            display: 'flex',
            justifyContent: imageJustifyContent,
            alignItems: 'center',
            width: '100%',
            height: '100%',
            opacity: imageFadeIn * fadeOutPhase2
          }}>
            <div style={{
              transform: `scale(${imageScale})`,
              transformOrigin: transformOrigin,
              boxShadow: `0 30px 60px rgba(0,0,0,0.6), 0 0 40px ${hexToRgba(colors.primary, 0.3)}`,
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.15)',
              width: largeImageWidth,
              maxWidth: isPortrait ? '100%' : '1300px',
              aspectRatio: '1440 / 900',
              overflow: 'hidden',
              background: '#111'
            }}>
              <Img
                src={staticFile(sceneData.img)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: imageFit,
                  objectPosition: objectPosition
                }}
              />
            </div>
          </div>

          {/* 文字层 - 绝对定位淡出 */}
          <div style={{
            position: 'absolute',
            top: isPortrait ? '5%' : '8%',
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: textOpacity,
            paddingLeft: '40px',
            paddingRight: '40px',
            zIndex: 10
          }}>
            <h2 style={{
              fontSize: titleFontSize,
              lineHeight: isLongText ? 1.15 : 1.1,
              color: textColor,
              margin: '0 0 15px 0',
              textShadow: isLongText ? '0 2px 4px rgba(0,0,0,0.5)' : 'none'
            }}>{sceneData.title}</h2>
          </div>
        </AbsoluteFill>
      );
    };

    // 根据当前帧判断渲染哪个阶段
    // 阶段1: 主配音播放中
    // 过渡阶段: 主配音结束后，次配音开始前
    // 阶段2: 次配音播放中
    const isPhase1 = frame < mainDuration;
    const isTransition = frame >= mainDuration && frame < mainDuration + transitionDuration;

    return (
      <>
        {isPhase1 ? renderPhase1() : (isTransition ? renderTransition() : renderPhase2())}
      </>
    );
  };

  // 单阶段渲染（原有逻辑）
  const renderSinglePhaseScene = () => {
    return (
      <AbsoluteFill style={{
        flexDirection: isCenterMode ? 'column' : (layout === 'left' ? 'row' : 'row-reverse'),
        justifyContent: 'center', alignItems: 'center',
        padding: isPortrait ? '0 40px' : (isCenterMode ? '100px' : '0 120px'),
        opacity: fadeOut, perspective: '1500px'
        }}>
          <Sequence from={sceneData.audioStartFrame}>
            <Audio src={staticFile(sceneData.audioFile)} />
          </Sequence>

          <div style={{
            flex: isPortrait ? 0 : 1,
            textAlign: isCenterMode ? 'center' : 'left',
            opacity: enter,
            transform: `translateY(${interpolate(enter,[0, 1], [50, 0])}px)`,
            marginBottom: textMarginBottom,
            padding: isCenterMode ? '0' : (layout === 'left' ? '0 60px 0 0' : '0 0 0 60px'),
            maxHeight: isPortrait ? '35%' : 'auto',
            overflow: 'hidden'
          }}>
            <h2 style={{
              fontSize: titleFontSize,
              lineHeight: isLongText ? 1.15 : 1.1,
              color: textColor,
              margin: '0 0 15px 0',
              textShadow: isLongText ? '0 2px 4px rgba(0,0,0,0.5)' : 'none'
            }}>{sceneData.title}</h2>
            {sceneData.subText && <p style={{
              fontSize: subTextFontSize,
              lineHeight: 1.3,
              color: subTextColor,
              margin: 0,
              display: isVeryLongText ? '-webkit-box' : 'block',
              WebkitLineClamp: isVeryLongText ? 3 : 'unset',
              WebkitBoxOrient: 'vertical',
              overflow: isVeryLongText ? 'hidden' : 'visible'
            }}>{sceneData.subText}</p>}
          </div>
          <div style={{ flex: isCenterMode ? 0 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ transform: `translateY(${translateY}px) rotateY(${rotateY}deg) scale(${slowZoom})`, boxShadow: `0 30px 60px rgba(0,0,0,0.6), 0 0 40px ${hexToRgba(colors.primary, 0.3)}`, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.15)', width: imageWidth, aspectRatio: '1440 / 900', overflow: 'hidden', background: '#111', flexShrink: 0 }}>
              <Img
                src={staticFile(sceneData.img)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: imageFit,
                  objectPosition: objectPosition
                }}
              />
            </div>
          </div>
        </AbsoluteFill>
    );
  };

  // 根据是否有两阶段数据选择渲染方式
  return hasTwoPhase ? renderTwoPhaseScene() : renderSinglePhaseScene();
};

// --- 主视频时间轴 ---
export const ClickCastVideo: React.FC = () => {
  // BGM 配置
  const bgmConfig = timeline.bgm as any;
  const bgmSrc = bgmConfig?.src || 'bensound-slowlife.mp3';
  const bgmVolume = bgmConfig?.volume || 0.15;
  const bgmLoop = bgmConfig?.loop !== false;

  return (
    <AbsoluteFill>
      <Background />

      {/* 🎵 背景音乐 - AI 智能选择 */}
      <Audio
        src={staticFile(bgmSrc)}
        volume={bgmVolume}
        loop={bgmLoop}
      />

      {timeline.scenes.map((scene: any) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.durationInFrames}
        >
          <DynamicScene sceneData={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
