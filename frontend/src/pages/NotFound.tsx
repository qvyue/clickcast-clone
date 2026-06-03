import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      color: '#8b949e',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textAlign: 'center',
      padding: '2rem',
    }}>
      <h1 style={{ fontSize: '4rem', fontWeight: 800, color: '#fff', margin: '0 0 0.5rem' }}>404</h1>
      <p style={{ fontSize: '1.1rem', margin: '0 0 1.5rem' }}>Page not found</p>
      <Link
        to="/"
        style={{
          padding: '0.6rem 1.5rem',
          background: '#58a6ff',
          color: '#fff',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '0.9rem',
        }}
      >
        Back to Home
      </Link>
    </div>
  )
}
