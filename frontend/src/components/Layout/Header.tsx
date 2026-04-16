interface HeaderProps {
  onCreateNew?: () => void
}

export default function Header({ onCreateNew }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-logo">
        <span>🎬</span>
        <span>ClickCast Pipeline</span>
      </div>
      <div className="header-actions">
        {onCreateNew && (
          <button className="btn btn-primary" onClick={onCreateNew}>
            + New Video
          </button>
        )}
      </div>
    </header>
  )
}
