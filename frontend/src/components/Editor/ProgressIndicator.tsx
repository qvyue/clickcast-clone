/**
 * ProgressIndicator - Shows countdown during voiceover generation
 *
 * Design: Simple text with estimated remaining time
 * Reduces user anxiety by showing how long to wait
 */

import React, { useState, useEffect, useRef } from 'react';

interface ProgressIndicatorProps {
  /** Estimated duration in seconds */
  estimatedSeconds: number;
  /** Called when countdown completes (optional) */
  onComplete?: () => void;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  estimatedSeconds,
}) => {
  const [remaining, setRemaining] = useState(estimatedSeconds);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    setRemaining(estimatedSeconds);
    startTimeRef.current = Date.now();

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const newRemaining = Math.max(1, Math.ceil(estimatedSeconds - elapsed));
      setRemaining(newRemaining);
    }, 100);

    return () => clearInterval(interval);
  }, [estimatedSeconds]);

  return (
    <div className="progress-indicator">
      <div className="progress-indicator-bar">
        <div
          className="progress-indicator-fill"
          style={{
            width: `${Math.max(5, 100 - (remaining / estimatedSeconds) * 100)}%`,
          }}
        />
      </div>
      <div className="progress-indicator-text">
        Generating voiceover... {remaining}s
      </div>
    </div>
  );
};

/**
 * Hook to manage countdown state
 * Returns estimated time based on text length
 */
export function useEstimatedTime(text: string): number {
  if (!text || text.trim().length === 0) return 3;

  // Rough estimate: ~10 characters per second for TTS
  // Minimum 2 seconds, maximum 15 seconds
  const chars = text.trim().length;
  const estimated = Math.max(2, Math.min(15, Math.ceil(chars / 10)));

  return estimated;
}

export default ProgressIndicator;
