import { useState } from 'react'
import { getVideoUrl } from '../../api/client'
import type { Website } from '../../types'

interface PreviewStepProps {
  domain: string
  website: Website
}

export default function PreviewStep({ domain, website }: PreviewStepProps) {
  const [aspectRatio, setAspectRatio] = useState<'landscape' | 'portrait'>('landscape')

  const hasVideo = aspectRatio === 'landscape'
    ? website.hasLandscape
    : website.hasPortrait

  return (
    <div className="step-panel">
      <div className="step-panel-header">
        <h2 className="step-panel-title">🎬 Preview</h2>
      </div>

      {/* Aspect Ratio Toggle */}
      <div className="aspect-toggle">
        <button
          className={`aspect-btn ${aspectRatio === 'landscape' ? 'active' : ''}`}
          onClick={() => setAspectRatio('landscape')}
        >
          16:9 Landscape
        </button>
        <button
          className={`aspect-btn ${aspectRatio === 'portrait' ? 'active' : ''}`}
          onClick={() => setAspectRatio('portrait')}
        >
          9:16 Portrait
        </button>
      </div>

      {/* Video Player */}
      {hasVideo ? (
        <div
          className="video-player-container"
          style={{
            aspectRatio: aspectRatio === 'landscape' ? '16/9' : '9/16',
            maxWidth: aspectRatio === 'portrait' ? '400px' : '100%',
            margin: aspectRatio === 'portrait' ? '0 auto' : undefined,
          }}
        >
          <video
            src={getVideoUrl(domain, aspectRatio)}
            controls
            style={{ width: '100%', height: '100%', background: '#000' }}
          />
        </div>
      ) : (
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <div className="empty-state-icon">📹</div>
          <h3>No {aspectRatio} video rendered yet</h3>
          <p>Run the render command to generate the video</p>
          <button className="btn btn-primary" style={{ marginTop: '16px' }}>
            Render {aspectRatio}
          </button>
        </div>
      )}

      {/* Download Options */}
      {hasVideo && (
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <a
            className="btn btn-primary"
            href={getVideoUrl(domain, aspectRatio)}
            download
          >
            Download {aspectRatio}
          </a>
          {aspectRatio === 'landscape' && website.hasPortrait && (
            <a
              className="btn btn-secondary"
              href={getVideoUrl(domain, 'portrait')}
              download
            >
              Download Portrait
            </a>
          )}
          {aspectRatio === 'portrait' && website.hasLandscape && (
            <a
              className="btn btn-secondary"
              href={getVideoUrl(domain, 'landscape')}
              download
            >
              Download Landscape
            </a>
          )}
        </div>
      )}
    </div>
  )
}
