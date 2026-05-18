// src/Root.tsx
import React from 'react';
import { Composition } from 'remotion';
import { VidGenVideo } from './ClickCastVideo';
import './style.css'; 

// 直接引入我们用 Node.js 算好的动态时间轴
import timeline from '../public/timeline.json';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VidGenPromo-Landscape"
        component={VidGenVideo}
        durationInFrames={timeline.totalFrames}
        fps={timeline.fps}
        width={1920}
        height={1080}
      />
      <Composition
        id="VidGenPromo-Portrait"
        component={VidGenVideo}
        durationInFrames={timeline.totalFrames}
        fps={timeline.fps}
        width={1080}
        height={1920}
      />
    </>
  );
};
