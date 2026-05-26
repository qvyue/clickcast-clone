import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Navbar.css';
import { useAuthStore } from '../store/authStore';
import { useBillingStore } from '../store/billingStore';

interface NavbarProps {
  variant?: 'home' | 'dashboard';
}

export const Navbar: React.FC<NavbarProps> = ({ variant = 'home' }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const billing = useBillingStore();
  const user = useAuthStore((s) => s.user);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const authSignOut = useAuthStore((s) => s.signOut);

  const scrollTo = (id: string) => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return;
    }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const signOut = async () => {
    await authSignOut();
    setShowUserMenu(false);
  };

  const logoSvg = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"></polygon>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
    </svg>
  );

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="nav-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            {logoSvg}
            VidGen
          </div>
          <div className="nav-links">
            {variant === 'home' ? (
              <>
                <a href="#workflow" onClick={(e) => { e.preventDefault(); scrollTo('workflow'); }}>Our Product</a>
                <a href="#use-cases" onClick={(e) => { e.preventDefault(); scrollTo('use-cases'); }}>Use Cases</a>
                <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo('pricing'); }}>Pricing</a>
                <a href="#faq" onClick={(e) => { e.preventDefault(); scrollTo('faq'); }}>FAQ</a>
              </>
            ) : (
              <>
                <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Home</a>
                <a href="/dashboard" className="nav-link-active" onClick={(e) => { e.preventDefault(); }}>Dashboard</a>
                <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo('pricing'); }}>Pricing</a>
              </>
            )}
          </div>
          <div className="nav-actions">
            {user ? (
              <div className="user-menu-wrapper">
                <button className="user-menu-trigger" onClick={() => setShowUserMenu(!showUserMenu)}>
                  <img src={user.user_metadata?.avatar_url || 'https://via.placeholder.com/32'} alt="Avatar" className="avatar" />
                  <span className="user-name">{user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </button>
                {showUserMenu && (
                  <div className="user-menu-dropdown">
                    <div className="user-menu-credits">
                      <span className="credits-amount">{billing.credits}</span>
                      <span className="credits-label">Credits</span>
                    </div>
                    <div className="user-menu-divider"></div>
                    {variant !== 'dashboard' && (
                      <a href="/dashboard" className="user-menu-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                        Dashboard
                      </a>
                    )}
                    <button onClick={signOut} className="user-menu-item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setShowLoginModal(true)} className="btn-signin">Sign In</button>
            )}
          </div>
        </div>
      </nav>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-accent"></div>
            <button className="modal-close" onClick={() => setShowLoginModal(false)}>✕</button>
            <div className="modal-body">
              <h2>Welcome to VidGen</h2>
              <p className="modal-sub">Sign in to create videos and manage your dashboard</p>
              <button className="google-btn" onClick={signInWithGoogle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
              <p className="modal-terms">By signing in, you agree to our <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a></p>
              <div className="modal-trial">
                <p>🎉 Get 2 day free trial</p>
              </div>
            </div>
            <div className="modal-accent"></div>
          </div>
        </div>
      )}
    </>
  );
};
