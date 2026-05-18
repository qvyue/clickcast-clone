/**
 * ClickCastVideo 组件
 * 功能：主视频容器，负责组合背景层、BGM、场景序列
 *
 * 架构：
 * Background（渐变背景）→ Audio（BGM）→ Sequence[]（场景序列）
 *
 * 核心概念：
 * - Sequence: Remotion 的时序组件，from/durationInFrames 控制场景在时间轴上的位置
 * - DynamicScene: 实际渲染单个场景内容（图片、文字、动画）
 */
import React from 'react';
import { AbsoluteFill, Sequence, Audio } from 'remotion';
import { Timeline } from '../types';
import { Background } from './Background';
import { DynamicScene } from './DynamicScene';

interface VidGenVideoProps {
  timeline: Timeline;
  domain: string;
}

export const VidGenVideo: React.FC<VidGenVideoProps> = ({ timeline, domain }) => {
  const colors = timeline.style?.colors || {
    primary: '#9b4dff',
    secondary: '#6b21a8',
    accent: '#d480ff',
    background: '#05010d',
    text: '#ffffff',
  };

  const imageBaseUrl = `/websites/${domain}/public`;
  const audioBaseUrl = `/websites/${domain}/public`;

  // BGM 配置：从 timeline.bgm 读取，默认使用 bensound-slowlife.mp3
  // - src: 音频文件路径（相对于 /public 目录）
  // - volume: 音量（0-1），默认 0.15
  // - loop: 是否循环播放，默认 true
  const bgmConfig = timeline.bgm;
  const bgmSrc = bgmConfig?.src ?? 'bensound-slowlife.mp3';
  const bgmVolume = bgmConfig?.volume ?? 0.15;
  const bgmLoop = bgmConfig?.loop !== false;

  return (
    <AbsoluteFill>
      {/* 背景渐变层 */}
      <Background colors={colors} />

      {/* 背景音乐（BGM） */}
      <Audio
        src={`/${bgmSrc}`}
        volume={bgmVolume}
        loop={bgmLoop}
      />

      {/* 场景序列：每个场景通过 Sequence 组件按时间轴排列
          - from: 场景开始帧（scene.startFrame）
          - durationInFrames: 场景持续帧数
          - 场景之间无缝衔接，由 editorStore 计算时间轴 */}
      {timeline.scenes.map((scene, index) => (
        <Sequence
          key={scene.id || index}
          from={scene.startFrame}
          durationInFrames={scene.durationInFrames}
        >
          <DynamicScene
            sceneData={scene}
            colors={colors}
            imageBaseUrl={imageBaseUrl}
            audioBaseUrl={audioBaseUrl}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
