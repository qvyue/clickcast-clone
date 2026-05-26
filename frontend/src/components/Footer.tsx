import React from 'react';
import './Footer.css';

export const Footer: React.FC = () => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
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
            <a href="#pricing" onClick={e => { e.preventDefault(); scrollTo('pricing'); }}>Pricing</a>
            <a href="#use-cases" onClick={e => { e.preventDefault(); scrollTo('use-cases'); }}>Use Cases</a>
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
  );
};
