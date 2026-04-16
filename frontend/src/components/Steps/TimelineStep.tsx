import { getScreenshotUrl } from '../../api/client'
import type { Timeline } from '../../types'

interface TimelineStepProps {
  domain: string
  timeline: Timeline | null
}

export default function TimelineStep({ domain, timeline }: TimelineStepProps) {
  if (!timeline) {
    return (
      <div className="step-panel">
        <div className="step-panel-header">
          <h2 className="step-panel-title">⏱️ Timeline</h2>
        </div>
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <p>No timeline data available</p>
        </div>
      </div>
    )
  }

  const { fps, totalFrames, scenes } = timeline
  const totalDuration = totalFrames / fps

  return (
    <div className="step-panel">
      <div className="step-panel-header">
        <h2 className="step-panel-title">⏱️ Timeline</h2>
        <span className="step-panel-count">
          {totalDuration.toFixed(1)}s / {totalFrames} frames @ {fps}fps
        </span>
      </div>

      {/* Timeline Visualization */}
      <div className="timeline-visualizer">
        <div className="time-ruler">
          {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
            <span key={i} className="time-mark">{i}s</span>
          ))}
        </div>
        <div className="scenes-track">
          {scenes.map((scene) => {
            const left = (scene.startFrame / totalFrames) * 100
            const width = (scene.durationInFrames / totalFrames) * 100
            return (
              <div
                key={scene.id}
                className="scene-block"
                style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
                title={`${scene.title} (${scene.durationInFrames} frames)`}
              >
                <span>{scene.id}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Scene Details */}
      <h3 style={{ marginBottom: '12px' }}>Scene Details</h3>
      <div className="timeline-scenes">
        {scenes.map((scene) => (
          <div key={scene.id} className="timeline-scene-item">
            {scene.img && (
              <img
                className="timeline-scene-img"
                src={getScreenshotUrl(domain, scene.img)}
                alt={scene.title}
              />
            )}
            <div className="timeline-scene-info">
              <div className="timeline-scene-title">{scene.title}</div>
              <div className="timeline-scene-meta">
                Frame {scene.startFrame} - {scene.startFrame + scene.durationInFrames}{' '}
                ({(scene.durationInFrames / fps).toFixed(1)}s)
              </div>
              <div className="timeline-scene-meta">
                Layout: {scene.layout}
                {scene.audioFile && ` | Audio: ${scene.audioFile}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
