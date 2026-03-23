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

  // Intro 和 Outro 样式
  if (sceneData.id === 'intro' || sceneData.id === 'outro') {
    const scale = interpolate(enter, [0, 1], [3, 1]);
    const rotateX = interpolate(enter, [0, 1], [40, 0]);
    const isIntro = sceneData.id === 'intro';

    return (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', perspective: '1000px', padding: isPortrait ? '0 40px' : '0', opacity: fadeOut }}>
        <Sequence from={sceneData.audioStartFrame}><Audio src={staticFile(sceneData.audioFile)} /></Sequence>
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

      <div style={{ flex: isPortrait ? 0 : 1, textAlign: isCenterMode ? 'center' : 'left', opacity: enter, transform: `translateY(${interpolate(enter,[0, 1], [50, 0])}px)`, marginBottom: isCenterMode ? (isPortrait ? '80px' : '60px') : '0', padding: isCenterMode ? '0' : (layout === 'left' ? '0 60px 0 0' : '0 0 0 60px') }}>
        <h2 style={{ fontSize: isPortrait ? '70px' : (isCenterMode ? '50px' : '70px'), lineHeight: 1.1, color: textColor, margin: '0 0 20px 0' }}>{sceneData.title}</h2>
        {sceneData.subText && <p style={{ fontSize: isPortrait ? '35px' : '30px', color: subTextColor, margin: 0 }}>{sceneData.subText}</p>}
      </div>
      <div style={{ flex: isCenterMode ? 0 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ transform: `translateY(${translateY}px) rotateY(${rotateY}deg) scale(${slowZoom})`, boxShadow: `0 30px 60px rgba(0,0,0,0.6), 0 0 40px ${hexToRgba(colors.primary, 0.3)}`, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.15)', width: isPortrait ? '960px' : (isCenterMode ? '900px' : '750px'), aspectRatio: '1440 / 900', overflow: 'hidden', background: '#111', flexShrink: 0 }}>
          <Img
            src={staticFile(sceneData.img)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: imageFit, // AI 智能决定: contain 或 cover
              objectPosition: objectPosition // AI 智能决定焦点位置
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
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
