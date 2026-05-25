import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../pages/Home.css';

export const TermsPage: React.FC = () => {
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
          <h1 className="legal-title">Terms of Service</h1>
          <div className="legal-body">
            <section>
              <h2>1. Acceptance of Terms</h2>
              <p>
                By accessing or using VidGen, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section>
              <h2>2. Description of Service</h2>
              <p>
                VidGen is an AI-powered video generation tool that transforms website URLs into marketing videos. We provide a subscription-based service.
              </p>
            </section>

            <section>
              <h2>3. User Accounts</h2>
              <p>
                You must create an account to use VidGen. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
              </p>
            </section>

            <section>
              <h2>4. Subscriptions and Payments</h2>
              <p>
                VidGen operates on a subscription basis. By subscribing, you agree to the following:
              </p>
              <ul>
                <li>
                  <strong>Subscriptions:</strong> By subscribing, you agree to a paid monthly subscription. Your account will automatically renew each month unless cancelled.
                </li>
                <li>
                  <strong>Free Trial:</strong> New users may be eligible for a free trial period. Trial credits are limited and do not roll over. After the trial, a paid subscription is required to continue generating videos.
                </li>
                <li>
                  <strong>Video Credits:</strong> Each plan includes a specific number of video generations per month. Unused credits do not roll over to the next billing cycle.
                </li>
                <li>
                  <strong>Payment Processing:</strong> All payments are processed securely. We do not store your credit card information.
                </li>
                <li>
                  <strong>Cancellations:</strong> You can cancel your subscription at any time. Upon cancellation, your access (including remaining video credits) will continue until the end of your current billing period. You will not be charged again.
                </li>
                <li>
                  <strong>Refunds:</strong> Payments are generally non-refundable. Even in the case the output video didn&apos;t meet your expectations we are not responsible for refunding any amount whether it&apos;s subscription money or one time payment. Please be sure to cancel your trial before it&apos;s charged for the next month if you don&apos;t want to continue with the service. Please contact support if you believe there has been a billing error.
                </li>
              </ul>
            </section>

            <section>
              <h2>5. Acceptable Use</h2>
              <p>
                You agree not to use VidGen to generate content that is illegal, harmful, defamatory, or infringes on third-party intellectual property rights. We reserve the right to suspend or terminate accounts that violate these terms.
              </p>
            </section>

            <section>
              <h2>6. Limitation of Liability</h2>
              <p>
                VidGen is provided &quot;as is&quot; without any warranties. We shall not be liable for any indirect, incidental, or consequential damages resulting from the use or inability to use our service.
              </p>
            </section>

            <section>
              <h2>7. Video Retention Policy</h2>
              <p>
                Generated videos are temporary and intended for immediate download. Videos will be automatically deleted from our servers 48 hours after they are successfully generated. It is your responsibility to download your videos before they expire.
              </p>
            </section>

            <section>
              <h2>8. Contact Us</h2>
              <p>
                For any further help, questions, or concerns regarding these Terms, please contact us at <strong>luoxiaoyu198961@gmail.com</strong>.
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
