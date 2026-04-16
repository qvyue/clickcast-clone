import React from 'react';
import { AbsoluteFill, Sequence, Audio } from 'remotion';
import { Timeline } from '../types';
import { Background } from './Background';
import { DynamicScene } from './DynamicScene';

interface ClickCastVideoProps {
  timeline: Timeline;
  domain: string;
}

export const ClickCastVideo: React.FC<ClickCastVideoProps> = ({ timeline, domain }) => {
  const colors = timeline.style?.colors || {
    primary: '#9b4dff',
    secondary: '#6b21a8',
    accent: '#d480ff',
    background: '#05010d',
    text: '#ffffff',
  };

  const imageBaseUrl = `/websites/${domain}/public`;
  const audioBaseUrl = `/websites/${domain}/public`;

  // BGM config
  const bgmConfig = timeline.bgm;
  const bgmSrc = bgmConfig?.src ?? 'bensound-slowlife.mp3';
  const bgmVolume = bgmConfig?.volume ?? 0.15;
  const bgmLoop = bgmConfig?.loop !== false;

  return (
    <AbsoluteFill>
      <Background colors={colors} />

      {/* Background music */}
      <Audio
        src={`/${bgmSrc}`}
        volume={bgmVolume}
        loop={bgmLoop}
      />

      {/* Scenes */}
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
