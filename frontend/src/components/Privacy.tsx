import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../pages/Home.css';

export const PrivacyPage: React.FC = () => {
  const navigate = useNavigate();

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="home-container">
      {/* Navigation */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="nav-logo" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
            VidGen
          </div>
          <div className="nav-links">
            <a href="/#workflow">Our Product</a>
            <a href="/#use-cases">Use Cases</a>
            <a href="/#pricing">Pricing</a>
            <a href="/#faq">FAQ</a>
          </div>
          <div className="nav-actions">
            <button onClick={() => navigate('/')} className="btn-signin">Back to Home</button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="legal-page">
        <div className="legal-container">
          <h1 className="legal-title">Privacy Policy</h1>
          <div className="legal-body">
            <section>
              <h2>1. Introduction</h2>
              <p>
                Welcome to VidGen (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our service.
              </p>
            </section>

            <section>
              <h2>2. Information We Collect</h2>
              <p>
                We collect information that you provide directly to us when you create an account, purchase credits, or use our video generation services. This includes:
              </p>
              <ul>
                <li>
                  Account information (name, email address, profile picture via Google Auth).
                </li>
                <li>
                  Usage data (URLs processed, video generation history).
                </li>
                <li>
                  Payment information (processed securely through our payment providers).
                </li>
              </ul>
            </section>

            <section>
              <h2>3. How We Use Your Information</h2>
              <p>
                We use your information to:
              </p>
              <ul>
                <li>
                  Provide and maintain our video generation service.
                </li>
                <li>
                  Process your payments and manage your credit balance.
                </li>
                <li>
                  Communicate with you about service updates or support.
                </li>
                <li>
                  Improve our AI models and user experience.
                </li>
              </ul>
            </section>

            <section>
              <h2>4. Data Storage and Security</h2>
              <p>
                We use industry-standard security measures to protect your data. Your account information is managed through secure authentication providers. Payment information is handled securely by our payment providers. We do not store your credit card details on our servers.
              </p>
            </section>

            <section>
              <h2>5. Third-Party Services</h2>
              <p>
                We use third-party services for authentication and database management. These services have their own privacy policies which we encourage you to review.
              </p>
            </section>

            <section>
              <h2>6. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us at <strong>luoxiaoyu198961@gmail.com</strong>.
              </p>
            </section>
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="footer-logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
              VidGen
            </div>
            <p className="footer-desc">Transform your website, text and ideas into stunning videos in minutes with our automated video creation SaaS.</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>Product</h4>
              <a href="/#pricing">Pricing</a>
              <a href="/#use-cases">Use Cases</a>
            </div>
            <div className="footer-col">
              <h4>Legal</h4>
              <a href="/terms">Terms of Service</a>
              <a href="/privacy">Privacy Policy</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} VidGen. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};
