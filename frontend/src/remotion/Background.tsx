import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { hexToRgba } from './utils';

interface BackgroundProps {
  colors: {
    primary: string;
    secondary: string;
    background: string;
  };
}

export const Background: React.FC<BackgroundProps> = ({ colors }) => {
  const { width, height } = useVideoConfig();
  const isPortrait = height > width;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute',
        top: isPortrait ? '10%' : '20%',
        left: isPortrait ? '10%' : '30%',
        width: isPortrait ? '80%' : '40%',
        height: '50%',
        background: `radial-gradient(circle, ${hexToRgba(colors.primary, 0.4)} 0%, rgba(0,0,0,0) 70%)`,
        filter: 'blur(80px)'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: isPortrait ? '-20%' : '10%',
        width: isPortrait ? '120%' : '50%',
        height: '60%',
        background: `radial-gradient(circle, ${hexToRgba(colors.secondary, 0.5)} 0%, rgba(0,0,0,0) 70%)`,
        filter: 'blur(100px)'
      }} />
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: '-50%',
        width: '200%',
        height: isPortrait ? '30%' : '40%',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        transform: 'perspective(500px) rotateX(75deg) translateY(100px)',
        maskImage: 'linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0))',
        WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0))'
      }} />
    </AbsoluteFill>
  );
};
