import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';
import { useAuthStore } from '../store/authStore';
import { useBillingStore } from '../store/billingStore';
import { fetchWithTimeout } from '../api/client';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

// Assuming generateVideo logic from the server.js will be invoked via fetch
export const Home: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ active: false, text: 'Preparing...', percent: 0 });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const billing = useBillingStore();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    // 已登录时加载积分数据
    if (user) {
      billing.refresh();
    }

    // Check checkout callback params
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout_success')) {
      setCheckoutMessage('Payment successful! Your subscription is now active.');
      billing.refresh();
      window.history.replaceState({}, '', '/');
    } else if (params.get('checkout_cancel')) {
      setCheckoutMessage('Checkout was cancelled.');
      window.history.replaceState({}, '', '/');
    }
    if (params.get('checkout_success') || params.get('checkout_cancel')) {
      setTimeout(() => setCheckoutMessage(null), 5000);
    }
  }, [user]);

  const handleGenerate = async () => {
    if (!url.trim()) {
      alert('Please enter a valid URL');
      return;
    }
    
    setLoading(true);
    setProgress({ active: true, text: 'Submitting...', percent: 0 });

    try {
      const res = await fetchWithTimeout('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), aspectRatio: 'landscape' })
      });
      const data = await res.json();

      if (data.error) {
        alert(data.error);
        setLoading(false);
        setProgress({ active: false, text: '', percent: 0 });
        return;
      }

      pollStatus(data.jobId, Date.now());
    } catch (error: any) {
      alert('Submission failed: ' + error.message);
      setLoading(false);
      setProgress({ active: false, text: '', percent: 0 });
    }
  };

  const pollStatus = async (jobId: string, startTime: number) => {
    const pollInterval = setInterval(async () => {
      if (Date.now() - startTime > 480000) { // 8 minutes timeout
        clearInterval(pollInterval);
        alert('Generation timed out. Please try again.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetchWithTimeout(`/api/status/${jobId}`);
        const data = await res.json();

        setProgress({ active: true, text: data.message, percent: data.progress });

        if (data.status === 'completed') {
          clearInterval(pollInterval);
          if (data.domain && !data.videoUrl) {
            navigate(`/editor/${data.domain}`);
          } else {
            setLoading(false);
          }
        }

        if (data.status === 'failed') {
          clearInterval(pollInterval);
          alert('Generation failed: ' + (data.message || 'please try again'));
          setLoading(false);
        }
      } catch (error) {
        console.error('Status poll error:', error);
      }
    }, 2000);
  };

  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="home-container">
      {/* Navigation */}
      <Navbar variant="home" />

      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-glow"></div>
        <div className="hero-content">
          <h1 className="hero-title">
            Paste your URL,<br />
            Get <span className="text-gradient">website video</span><br />
            in minutes
          </h1>
          <p className="hero-subtitle">
            Transform any website into a professional marketing video instantly. No recording, no editing just paste your URL. Skip the hassle of hiring freelancers or spending days creating videos yourself.
          </p>
          
          <div className="hero-action-box">
            <div className="url-input-wrapper">
              <input 
                type="url" 
                placeholder="https://your-website.com" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                className="url-input"
              />
              <button 
                onClick={handleGenerate} 
                disabled={loading || !url}
                className="btn-generate"
              >
                {loading ? 'Generating...' : 'Generate Free'}
                {!loading && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
              </button>
            </div>
            
            {progress.active && (
              <div className="progress-container">
                <div className="progress-text">{progress.text}</div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }}></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Workflow Section */}
      <section id="workflow" className="workflow-section">
        <div className="section-container">
          <div className="section-header-center">
            <h2 className="section-title">Workflow <span className="text-muted">Simplified</span></h2>
            <p className="section-desc">From URL to render in three simple steps.</p>
          </div>
          <div className="workflow-grid">
            <div className="workflow-card">
              <div className="workflow-step-num">1</div>
              <div className="workflow-icon">🔗</div>
              <h3>Paste your URL</h3>
              <p>Input any valid website address. Our system connects to your live site to capture assets.</p>
            </div>
            <div className="workflow-card">
              <div className="workflow-step-num">2</div>
              <div className="workflow-icon">🧠</div>
              <h3>AI Analyzes & Plans</h3>
              <p>Our agent extracts text and visual hierarchy, then writes a structured script and plans scenes.</p>
            </div>
            <div className="workflow-card">
              <div className="workflow-step-num">3</div>
              <div className="workflow-icon">🎬</div>
              <h3>Cinematic Video</h3>
              <p>Remotion orchestrates screenshots, voiceovers, and dynamic text into a ready-to-use marketing video.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why VidGen Section */}
      <section className="why-section">
        <div className="section-container why-container">
          <div className="why-header">
            <h2 className="section-title">Why <span className="text-gradient">VidGen</span>?</h2>
            <p className="why-desc">
              Creating marketing or launch videos is time-consuming and expensive. You either spend tens of thousands on agencies or waste hours learning complex video editors.
              <br/><br/>
              VidGen solves this by offering an instant, highly customizable video engine. We enforce strict narrative alignment between subtitles and voiceovers, delivering a polished video automatically.
            </p>
          </div>
          <div className="comparison-card">
            <div className="comp-col old-way">
              <h4>Traditional Way</h4>
              <ul>
                <li><span className="cross">✕</span> Manual recording</li>
                <li><span className="cross">✕</span> Days of video editing</li>
                <li><span className="cross">✕</span> Expensive voice actors</li>
                <li><span className="cross">✕</span> Slow iterations</li>
              </ul>
            </div>
            <div className="comp-col new-way">
              <h4>With VidGen</h4>
              <ul>
                <li><span className="check">✓</span> 1-click URL generation</li>
                <li><span className="check">✓</span> Instant AI scripting</li>
                <li><span className="check">✓</span> Realistic AI Voices</li>
                <li><span className="check">✓</span> Edit in browser</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Built For Section */}
      <section id="use-cases" className="built-for-section">
        <div className="section-container">
          <div className="section-header-center">
            <h2 className="section-title">Built for <span className="text-muted">Builders</span></h2>
          </div>
          <div className="builders-grid">
            <div className="builder-card">
              <div className="builder-icon">🚀</div>
              <h4>SaaS Founders</h4>
              <p>Launch your product with a professional demo video before you even have a marketing team.</p>
            </div>
            <div className="builder-card">
              <div className="builder-icon">💻</div>
              <h4>Indie Hackers</h4>
              <p>Stop spending days editing videos. Ship your features, paste your URL, and get back to coding.</p>
            </div>
            <div className="builder-card">
              <div className="builder-icon">📈</div>
              <h4>Marketing Teams</h4>
              <p>A/B test different video styles and messaging instantly without blocking the design team.</p>
            </div>
            <div className="builder-card">
              <div className="builder-icon">🎓</div>
              <h4>Students</h4>
              <p>Showcase your projects and assignments with cinematic flair that impresses professors and recruiters.</p>
            </div>
            <div className="builder-card">
              <div className="builder-icon">💼</div>
              <h4>Professionals</h4>
              <p>Present your portfolio websites as dynamic reels that stand out on social media.</p>
            </div>
            <div className="builder-card">
              <div className="builder-icon">🏢</div>
              <h4>Businesses</h4>
              <p>Enhance your corporate presence with explainer videos that highlight your services effectively.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="pricing-section">
        <div className="section-container">
          <div className="section-header-center">
            <h2 className="section-title">Simple <span className="text-muted">Pricing</span></h2>
            <p className="section-desc">Cancel anytime · No hidden fees</p>
          </div>

          <div className="pricing-grid pricing-grid-duo">
            {/* Pro Plan - Most Popular */}
            <div className="pricing-card pricing-card-highlight">
              <div className="pricing-badge">Most Popular</div>
              <div className="pricing-card-head">
                <div className="pricing-icon">⭐</div>
                <h3 className="pricing-name">Pro</h3>
              </div>
              <div className="pricing-price-wrap">
                <span className="pricing-price">$15</span>
                <span className="pricing-period">/month</span>
                <span className="pricing-strike">$29</span>
              </div>
              <p className="pricing-subnote">2 day Free trial</p>
              <div className="pricing-divider"></div>
              <ul className="pricing-features">
                <li><span className="check">✓</span> <strong>30 Credits / Month</strong></li>
                <li><span className="check">✓</span> 1080p · 60 FPS export</li>
                <li><span className="check">✓</span> Premium AI voices (ElevenLabs)</li>
                <li><span className="check">✓</span> Smart BGM auto-matching</li>
                <li><span className="check">✓</span> Editor with timeline & scene tweaks</li>
                <li><span className="check">✓</span> Priority email support</li>
              </ul>
              <button onClick={() => user ? billing.startCheckout('pro') : setShowLoginModal(true)} className="pricing-cta-primary">Start Free Trial</button>
            </div>

            {/* Credit Pack - One Time */}
            <div className="pricing-card">
              <div className="pricing-card-head">
                <div className="pricing-icon">💎</div>
                <h3 className="pricing-name">Credit Pack</h3>
              </div>
              <div className="pricing-price-wrap">
                <span className="pricing-price">$3</span>
                <span className="pricing-period">one-time</span>
                <span className="pricing-strike">$5</span>
              </div>
              <p className="pricing-subnote">Credits never expire</p>
              <div className="pricing-divider"></div>
              <ul className="pricing-features">
                <li><span className="check">✓</span> <strong>3 Credits</strong></li>
                <li><span className="check">✓</span> 1080p · 60 FPS export</li>
                <li><span className="check">✓</span> Premium AI voices (ElevenLabs)</li>
                <li><span className="check">✓</span> Landscape & Portrait formats</li>
                <li><span className="check">✓</span> No subscription required</li>
                <li><span className="check">✓</span> Pay only when you need</li>
              </ul>
              <button onClick={() => user ? billing.startCheckout('credit_pack') : setShowLoginModal(true)} className="pricing-cta-secondary">Buy Credits</button>
            </div>
          </div>

          <div className="pricing-footnote">
            {checkoutMessage && (
              <p style={{ color: 'var(--accent-green)', marginBottom: '12px', fontSize: '14px' }}>{checkoutMessage}</p>
            )}
            <a href="/terms" target="_blank" rel="noopener noreferrer">Read our Terms of Service</a>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="faq-section">
        <div className="section-container">
          <div className="section-header-center">
            <h2 className="section-title">Common <span className="text-muted">Questions</span></h2>
          </div>
          <div className="faq-list">
            {[
              {
                q: 'What is the best AI video generator for SaaS product videos?',
                a: 'VidGen is specifically designed to automate the generation of SaaS explainer videos. We connect directly to your URL to capture real UI screenshots and synthesize a professional narrative.',
              },
              {
                q: 'Can I convert website into video?',
                a: 'Yes! Simply paste your URL and our engine will analyze the page, write a script, generate voiceovers, and render a complete video within minutes.',
              },
              {
                q: 'How does VidGen compare to Synthesia or HeyGen?',
                a: 'While those platforms focus on avatar generation, VidGen focuses on your product\'s UI and storytelling. We automatically script and capture your actual website.',
              },
              {
                q: 'How long does video generation take?',
                a: 'Most videos are generated in less than 10 minutes, acting as a high-speed startup promo video maker.',
              },
            ].map((item, i) => (
              <div key={i} className={`faq-item${i === 0 ? ' open' : ''}`}>
                <button className="faq-q" onClick={() => {
                  document.querySelectorAll('.faq-item').forEach((el, j) => {
                    if (j === i) el.classList.toggle('open');
                    else el.classList.remove('open');
                  });
                }}>
                  <span>{item.q}</span>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="faq-icon">
                    <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" d="M10 4v12M4 10h12" />
                  </svg>
                </button>
                <div className="faq-a-wrapper">
                  <p className="faq-a">{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* Login Modal trigger — kept for pricing CTA buttons */}
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
    </div>
  );
};
