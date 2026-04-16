import { useState, useRef } from 'react'
import { getAudioUrl } from '../../api/client'
import type { AudioFile } from '../../types'

interface VoiceoverStepProps {
  domain: string
  audioFiles: AudioFile[]
}

export default function VoiceoverStep({ domain, audioFiles }: VoiceoverStepProps) {
  const [playing, setPlaying] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handlePlay = (file: AudioFile) => {
    if (playing === file.name) {
      audioRef.current?.pause()
      setPlaying(null)
    } else {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      audioRef.current = new Audio(getAudioUrl(domain, file.name))
      audioRef.current.onended = () => setPlaying(null)
      audioRef.current.play()
      setPlaying(file.name)
    }
  }

  const totalDuration = audioFiles.reduce((sum, f) => sum + f.duration, 0)

  return (
    <div className="step-panel">
      <div className="step-panel-header">
        <h2 className="step-panel-title">🎙️ Voiceover</h2>
        <span className="step-panel-count">
          Total: {totalDuration.toFixed(1)}s
        </span>
      </div>

      <div className="audio-list">
        {audioFiles.map((file) => (
          <div key={file.name} className="audio-item">
            <span className="audio-icon">🎙️</span>
            <span className="audio-name">{file.name}</span>
            <span className="audio-duration">{file.duration.toFixed(1)}s</span>
            <button
              className="audio-play-btn"
              onClick={() => handlePlay(file)}
            >
              {playing === file.name ? '⏸ Stop' : '▶ Play'}
            </button>
          </div>
        ))}
      </div>

      {audioFiles.length === 0 && (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <p>No voiceover files found</p>
        </div>
      )}
    </div>
  )
}
