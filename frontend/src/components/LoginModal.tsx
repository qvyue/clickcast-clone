import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)

  if (!isOpen) return null

  const handleGoogleSignIn = () => {
    signInWithGoogle()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        position: 'relative', width: '100%', maxWidth: 420,
        background: 'rgba(23,23,23,0.95)', backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)', overflow: 'hidden',
      }}>
        {/* Top accent bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: 'linear-gradient(to right, #9b4dff, #d946ef, #9b4dff)',
        }} />

        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 12, right: 12,
          background: 'none', border: 'none', color: '#a3a3a3',
          cursor: 'pointer', padding: 6, borderRadius: 6,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>

        <div style={{ padding: '40px 32px 32px' }}>
          <h2 style={{
            fontSize: 22, fontWeight: 700, color: '#fff',
            textAlign: 'center', marginBottom: 6,
          }}>
            Welcome to VidGen
          </h2>
          <p style={{
            fontSize: 14, color: '#a3a3a3',
            textAlign: 'center', marginBottom: 28,
          }}>
            Sign in to create videos and manage your dashboard
          </p>

          {/* Google Sign In button */}
          <button onClick={handleGoogleSignIn} style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 10,
            background: '#fff', color: '#171717', fontWeight: 500,
            padding: '12px 16px', borderRadius: 10, border: 'none',
            cursor: 'pointer', fontSize: 14,
            transition: 'background 0.15s',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p style={{
            fontSize: 11, color: '#737373', textAlign: 'center', marginTop: 20,
          }}>
            By signing in, you agree to our{' '}
            <a href="/terms" style={{ color: '#c084fc' }}>Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" style={{ color: '#c084fc' }}>Privacy Policy</a>
          </p>

          <div style={{
            marginTop: 16, paddingTop: 16,
            borderTop: '1px solid rgba(255,255,255,0.05)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 13, color: '#c084fc', fontWeight: 500 }}>
              🎉 Get 2 day free trial
            </p>
          </div>
        </div>

        {/* Bottom accent bar */}
        <div style={{
          height: 3,
          background: 'linear-gradient(to right, #9b4dff, #d946ef, #9b4dff)',
        }} />
      </div>
    </div>
  )
}

/**
 * AuthCallback component — handles OAuth redirect.
 * Reads session from URL hash and redirects to home.
 */
export function AuthCallback() {
  // On mount, let Supabase process the hash fragment,
  // then redirect to home
  if (typeof window !== 'undefined' && supabase) {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        window.location.href = '/'
      }
    })
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
      color: '#fff', fontFamily: 'system-ui, sans-serif',
    }}>
      <p>Signing in...</p>
    </div>
  )
}
