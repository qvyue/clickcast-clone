import { useState } from 'react'
import { getScreenshotUrl } from '../../api/client'
import type { ScrapedData } from '../../types'

interface ScreenshotStepProps {
  domain: string
  screenshots: string[]
  scrapedData: ScrapedData | null
}

export default function ScreenshotStep({
  domain,
  screenshots,
  scrapedData,
}: ScreenshotStepProps) {
  const [selectedShot, setSelectedShot] = useState<string | null>(null)

  const getBlockType = (filename: string): string => {
    const index = parseInt(filename.match(/\d+/)?.[0] || '1') - 1
    const blocks = scrapedData?.blocks || []
    return blocks[index]?.type || 'unknown'
  }

  const getBlockDesc = (filename: string): string => {
    const index = parseInt(filename.match(/\d+/)?.[0] || '1') - 1
    const blocks = scrapedData?.blocks || []
    const text = blocks[index]?.text || ''
    return text.length > 40 ? text.slice(0, 40) + '...' : text
  }

  return (
    <div className="step-panel">
      <div className="step-panel-header">
        <h2 className="step-panel-title">📸 Screenshots</h2>
        <span className="step-panel-count">{screenshots.length} captured</span>
      </div>

      {scrapedData && (
        <div
          style={{
            padding: '16px',
            background: 'var(--bg-hover)',
            borderRadius: '8px',
            marginBottom: '20px',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '8px' }}>
            {scrapedData.product || scrapedData.title}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {scrapedData.tagline || scrapedData.description}
          </div>
          {scrapedData.colors && scrapedData.colors.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              {scrapedData.colors.slice(0, 5).map((color, i) => (
                <div
                  key={i}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    background: color,
                    border: '1px solid var(--border)',
                  }}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="screenshot-grid">
        {screenshots.map((shot) => (
          <div
            key={shot}
            className={`screenshot-card ${selectedShot === shot ? 'selected' : ''}`}
            onClick={() => setSelectedShot(shot)}
          >
            <img src={getScreenshotUrl(domain, shot)} alt={shot} />
            <div className="screenshot-info">
              <span className="screenshot-type">{getBlockType(shot)}</span>
              <span className="screenshot-desc">{getBlockDesc(shot)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
