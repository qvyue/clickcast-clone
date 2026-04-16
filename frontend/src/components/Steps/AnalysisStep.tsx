import type { Timeline, VideoStyle } from '../../types'

interface AnalysisStepProps {
  timeline: Timeline | null
  style: VideoStyle | null
}

export default function AnalysisStep({ timeline, style }: AnalysisStepProps) {
  const colors = style?.colors || timeline?.style?.colors
  const scenes = timeline?.scenes || []

  return (
    <div className="step-panel">
      <div className="step-panel-header">
        <h2 className="step-panel-title">🤖 AI Analysis</h2>
      </div>

      {/* Style Preview */}
      {colors && (
        <div
          className="style-preview"
          style={{ background: colors.background }}
        >
          <h3 style={{ color: colors.text }}>
            {style?.name || 'Generated Style'}
          </h3>

          <div className="color-palette">
            {Object.entries(colors).map(([name, color]) => (
              <div key={name} className="color-swatch">
                <div
                  className="swatch-color"
                  style={{ backgroundColor: color }}
                />
                <span className="swatch-name">{name}</span>
                <span className="swatch-value">{color}</span>
              </div>
            ))}
          </div>

          <div
            className="gradient-preview"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
            }}
          >
            <button
              className="cta-button"
              style={{ color: colors.primary }}
            >
              GET STARTED
            </button>
          </div>
        </div>
      )}

      {/* Scene Script */}
      <h3 style={{ marginBottom: '12px' }}>Generated Scenes</h3>
      <div className="scene-list">
        {scenes.map((scene, index) => (
          <div key={scene.id} className="scene-item">
            <div className="scene-number">{index + 1}</div>
            <div className="scene-content">
              <div className="scene-title">{scene.title}</div>
              {scene.subText && (
                <div className="scene-subtitle">{scene.subText}</div>
              )}
            </div>
            <span className="scene-layout">{scene.layout}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
