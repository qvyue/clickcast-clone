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

  // 向后兼容：字段名映射
  // mainTitle 优先级：mainTitle > text > title
  const mainTitle = sceneData.mainTitle || '';
  const subTitle = sceneData.subTitle || '';

  // 检查是否有两阶段动画数据
  const hasTwoPhase = sceneData.audioFileSub && sceneData.subDuration;
  // mainDuration 和 subDuration 在 timeline.json 中是秒，需要转换成帧数
  const mainDuration = Math.round((sceneData.mainDuration || (sceneData.durationInFrames / fps)) * fps);
  const subDuration = Math.round((sceneData.subDuration || 0) * fps);
  // 主配音和次配音之间的过渡时间（帧数）
  const transitionDuration = Math.round((sceneData.transitionDuration || 0.5) * fps);

  // 根据背景颜色自动计算所有文字颜色，确保最佳对比度
  const bgColor = colors.background || '#05010d';
  const textColor = getContrastText(bgColor);
  const buttonTextColor = getButtonTextColor(colors.primary, colors.secondary);

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

    // 动态计算字幕的字体大小，根据文本长度调整
    const mainTitleLength = mainTitle.length;
    const mainTitleFontSize = mainTitleLength > 100 ? '24px' : (mainTitleLength > 60 ? '28px' : '30px');

    return (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', perspective: '1000px', padding: isPortrait ? '0 40px' : '0 80px', opacity: currentOpacity }}>
        {/* 阶段1: 主配音 */}
        <Sequence from={sceneData.audioStartFrame} durationInFrames={hasSubAudio ? mainDur : undefined}>
          <Audio src={staticFile(sceneData.audioFile)} />
        </Sequence>
        {/* 阶段2: 次配音 — 从主配音结束后播放 */}
        {hasSubAudio && (
          <Sequence from={sceneData.audioStartFrame + mainDur + transitionDur} durationInFrames={subDur}>
            <Audio src={staticFile(sceneData.audioFileSub)} />
          </Sequence>
        )}
        <div style={{ transform: `scale(${scale}) rotateX(${rotateX}deg)`, textAlign: 'center', maxWidth: isPortrait ? '95%' : '1300px', width: '100%' }}>
          {isIntro && isPhase1 && (
            <div style={{ background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`, padding: '8px 24px', borderRadius: '50px', display: 'inline-block', fontSize: isPortrait ? '24px' : '20px', fontWeight: 800, letterSpacing: '2px', marginBottom: '30px', boxShadow: `0 0 20px ${hexToRgba(colors.primary, 0.5)}`, color: buttonTextColor, ...buttonTextStyle }}>INTRODUCING</div>
          )}
          {/* Phase 1: 显示 mainTitle */}
          {(isPhase1 || isTransition) && (
            <h1 style={{ fontSize: isPortrait ? '90px' : (isIntro ? '90px' : '80px'), lineHeight: isPortrait ? '1.1' : 'normal', margin: '0 0 20px 0', color: textColor, fontWeight: 800 }}>{mainTitle}</h1>
          )}
          {/* Phase 2: 显示 subTitle */}
          {isPhase2 && (
            <h1 style={{ fontSize: isPortrait ? '50px' : '40px', lineHeight: isPortrait ? '1.1' : 'normal', margin: '0 0 20px 0', color: textColor, fontWeight: 800 }}>{subTitle}</h1>
          )}
          {/* Outro CTA button */}
          {!isIntro && !hasSubAudio && (
            <>
              <div style={{ background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`, padding: '20px 50px', borderRadius: '12px', display: 'inline-block', fontSize: '30px', fontWeight: 'bold', color: buttonTextColor, letterSpacing: '1px', boxShadow: `0 10px 30px ${hexToRgba(colors.primary, 0.4)}`, marginTop: '20px', ...buttonTextStyle }}>GET STARTED</div>
            </>
          )}
        </div>
      </AbsoluteFill>
    );
  }

  // 正常截图展示
  const imageFit = sceneData.imageFit || 'contain';

  // 长图检测与滚动动画
  const imgWidth = sceneData.imageWidth;
  const imgHeight = sceneData.imageHeight;
  const isLongImage = sceneData.scrollImage === true || (imgWidth && imgHeight && (imgHeight / imgWidth > 1.2));

  // 滚动范围：0% → 65%（长图场景）
  const scrollStart = 0;
  const scrollEnd = isLongImage ? 65 : 0;
  const scrollProgress = isLongImage
    ? interpolate(
        frame,
        [0, duration * 0.2, duration * 0.8, duration],
        [scrollStart, scrollStart, scrollEnd, scrollEnd],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      )
    : 0;

  // Ken Burns 缓慢放大效果（仅非长图场景）
  const slowZoomNew = isLongImage ? 1 : interpolate(frame, [0, duration], [1, 1.08]);

  // 计算文本长度
  const isLongText = (mainTitle.length + subTitle.length) > 80;

  // 两阶段动画渲染函数
  const renderTwoPhaseScene = () => {
    const isPhase1 = frame < mainDuration;
    const isTransition = frame >= mainDuration && frame < mainDuration + transitionDuration;
    const isPhase2 = frame >= mainDuration + transitionDuration;

    // Phase 1: 全屏图 + 底部主文案
    const renderPhase1 = () => {
      const phase1Frame = frame;
      const enterPhase1 = spring({ frame: phase1Frame - 5, fps, config: { damping: 14 } });
      const fadeOutPhase1 = interpolate(phase1Frame, [mainDuration - 15, mainDuration], [1, 0], { extrapolateRight: 'clamp' });

      return (
        <AbsoluteFill style={{ opacity: fadeOutPhase1 }}>
          <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#0a0a0a' }}>
            <Img
              src={staticFile(sceneData.img)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: isLongImage ? 'cover' : imageFit,
                objectPosition: isLongImage ? `center ${scrollProgress}%` : 'center',
                transform: isLongImage ? 'none' : `scale(${slowZoomNew})`,
              }}
            />
          </AbsoluteFill>
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
            <div style={{
              width: '100%',
              padding: isPortrait ? '60px 40px 40px 40px' : '80px 40px 50px 40px',
              opacity: enterPhase1,
              transform: `translateY(${interpolate(enterPhase1, [0, 1], [30, 0])}px)`,
            }}>
              <div style={{ width: '100%', textAlign: 'center' }}>
                <h2 style={{
                  fontSize: isPortrait ? '42px' : (isLongText ? '48px' : '56px'),
                  lineHeight: 1.2,
                  color: '#ffffff',
                  margin: '0 0 12px 0',
                  fontWeight: 700,
                  textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 4px 8px rgba(0,0,0,0.6), 0 8px 16px rgba(0,0,0,0.4)',
                }}>{mainTitle}</h2>
              </div>
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      );
    };

    // 过渡阶段
    const renderTransition = () => (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }} />
    );

    // Phase 2: 全屏图 + 底部次文案
    const renderPhase2 = () => {
      const phase2Frame = frame - mainDuration - transitionDuration;
      const imageFadeIn = interpolate(phase2Frame, [0, fps * 0.3], [0, 1], { extrapolateRight: 'clamp' });
      const actualSubDuration = Math.max(subDuration, fps * 3);
      const fadeOutPhase2 = interpolate(phase2Frame, [actualSubDuration - fps * 0.5, actualSubDuration], [1, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
      const enterPhase2 = spring({ frame: phase2Frame - 5, fps, config: { damping: 14 } });

      return (
        <AbsoluteFill style={{ opacity: imageFadeIn * fadeOutPhase2 }}>
          <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#0a0a0a' }}>
            <Img
              src={staticFile(sceneData.img)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: isLongImage ? 'cover' : imageFit,
                objectPosition: isLongImage ? `center ${scrollProgress}%` : 'center',
                transform: isLongImage ? 'none' : `scale(${slowZoomNew})`,
              }}
            />
          </AbsoluteFill>
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
            <div style={{
              width: '100%',
              padding: isPortrait ? '60px 40px 40px 40px' : '80px 40px 50px 40px',
              opacity: enterPhase2,
              transform: `translateY(${interpolate(enterPhase2, [0, 1], [30, 0])}px)`,
            }}>
              <div style={{ width: '100%', textAlign: 'center' }}>
                <h2 style={{
                  fontSize: isPortrait ? '42px' : (isLongText ? '48px' : '56px'),
                  lineHeight: 1.2,
                  color: '#ffffff',
                  margin: '0 0 12px 0',
                  fontWeight: 700,
                  textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 4px 8px rgba(0,0,0,0.6), 0 8px 16px rgba(0,0,0,0.4)',
                }}>{subTitle}</h2>
              </div>
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      );
    };

    return (
      <>
        <Sequence from={sceneData.audioStartFrame} durationInFrames={mainDuration}>
          <Audio src={staticFile(sceneData.audioFile)} />
        </Sequence>
        <Sequence from={sceneData.audioStartFrame + mainDuration + transitionDuration} durationInFrames={subDuration}>
          <Audio src={staticFile(sceneData.audioFileSub)} />
        </Sequence>
        {isPhase1 ? renderPhase1() : (isTransition ? renderTransition() : renderPhase2())}
      </>
    );
  };

  // 单阶段渲染：全屏图 + 底部文字叠加
  const renderSinglePhaseScene = () => {
    return (
      <AbsoluteFill style={{ opacity: fadeOut }}>
        <Sequence from={sceneData.audioStartFrame}>
          <Audio src={staticFile(sceneData.audioFile)} />
        </Sequence>

        {/* 全屏图片背景层 */}
        <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#0a0a0a' }}>
          <Img
            src={staticFile(sceneData.img)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: isLongImage ? 'cover' : imageFit,
              objectPosition: isLongImage ? `center ${scrollProgress}%` : 'center',
              transform: isLongImage ? 'none' : `scale(${slowZoomNew})`,
            }}
          />
        </AbsoluteFill>

        {/* 底部文字层 */}
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
          <div style={{
            width: '100%',
            padding: isPortrait ? '60px 40px 40px 40px' : '80px 40px 50px 40px',
            opacity: enter,
            transform: `translateY(${interpolate(enter, [0, 1], [30, 0])}px)`,
          }}>
            <div style={{ width: '100%', textAlign: 'center' }}>
              <h2 style={{
                fontSize: isPortrait ? '42px' : (isLongText ? '48px' : '56px'),
                lineHeight: 1.2,
                color: '#ffffff',
                margin: '0 0 12px 0',
                fontWeight: 700,
                textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 4px 8px rgba(0,0,0,0.6), 0 8px 16px rgba(0,0,0,0.4)',
              }}>{mainTitle}</h2>
              {subTitle && (
                <p style={{
                  fontSize: isPortrait ? '22px' : '24px',
                  lineHeight: 1.5,
                  color: 'rgba(255,255,255,0.95)',
                  margin: 0,
                  textShadow: '0 1px 3px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.5)',
                }}>{subTitle}</p>
              )}
            </div>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  };

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
