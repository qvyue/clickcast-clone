// src/ClickCastScene.tsx
import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Img,
  staticFile,
} from 'remotion';

export const ClickCastScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 1. 动画参数计算
  // 文本弹簧进场动画
  const textProgress = spring({
    frame: frame - 10, // 延迟 10 帧出现
    fps,
    config: { damping: 12 },
  });

  // 图片从下往上浮动并伴随 3D 倾斜的进场动画
  const imageEntrance = spring({
    frame: frame - 20, // 延迟 20 帧出现
    fps,
    config: { damping: 14, mass: 0.8 },
  });

  // 图片持续缓慢放大的效果 (Ken Burns)
  const slowZoom = interpolate(frame, [0, 150], [1, 1.1]);

  // 计算 3D 旋转角度 (一边进场一边翻转)
  const rotateY = interpolate(imageEntrance, [0, 1], [40, -15]); // 最终停在向左倾斜 -15 度
  const rotateX = interpolate(imageEntrance, [0, 1], [20, 5]); // 最终停在向上倾斜 5 度
  const translateY = interpolate(imageEntrance, [0, 1], [300, 0]);

  return (
    <AbsoluteFill
      style={{
        // 类似 Clickcast 的深邃星空紫渐变背景
        background: 'radial-gradient(circle at 50% 50%, #301050 0%, #0a0515 80%)',
        color: 'white',
        fontFamily: 'sans-serif',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '100px',
      }}
    >
      {/* 左侧：文字介绍区域 */}
      <div
        style={{
          flex: 1,
          opacity: textProgress,
          transform: `translateY(${interpolate(textProgress, [0, 1], [50, 0])}px)`,
        }}
      >
        <h1 style={{ fontSize: '80px', margin: '0 0 20px 0', fontWeight: 'bold' }}>
          Welcome to <span style={{ color: '#b484ff' }}>Your Site</span>
        </h1>
        <p style={{ fontSize: '40px', color: '#a0a0b0', lineHeight: 1.5 }}>
          Auto Website-to-Video<br />
          Perfect Animations.
        </p>
      </div>

      {/* 右侧：3D 网页截图展示区 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          perspective: '1500px', // 开启 3D 空间
        }}
      >
        <div
          style={{
            // 核心 3D 与 发光阴影 CSS
            transform: `translateY(${translateY}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${slowZoom})`,
            boxShadow: '0 0 80px rgba(180, 132, 255, 0.4), 0 20px 50px rgba(0,0,0,0.5)',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)',
            width: '800px',
            height: '500px',
          }}
        >
          {/* 读取之前通过 playwright 截好的图 */}
          <Img 
            src={staticFile('shot1.png')} 
            style={{ width: '100%', height: 'auto', display: 'block' }} 
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
