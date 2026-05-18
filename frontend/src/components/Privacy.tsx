import React from 'react';
import { useNavigate } from 'react-router-dom';

export const PrivacyPage: React.FC = () => {
  const navigate = useNavigate();

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#e5e5e5' }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#a1a1aa',
            padding: '6px 14px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          &larr; Back
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#fff' }}>Privacy Policy</h1>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
              1. Introduction
            </h2>
            <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
              Welcome to VidGen (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our service.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
              2. Information We Collect
            </h2>
            <p style={{ lineHeight: 1.7, color: '#a1a1aa', marginBottom: '12px' }}>
              We collect information that you provide directly to us when you create an account, purchase credits, or use our video generation services. This includes:
            </p>
            <ul style={{ listStyle: 'disc', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li style={{ color: '#a1a1aa', lineHeight: 1.7 }}>
                Account information (name, email address, profile picture via Google Auth).
              </li>
              <li style={{ color: '#a1a1aa', lineHeight: 1.7 }}>
                Usage data (URLs processed, video generation history).
              </li>
              <li style={{ color: '#a1a1aa', lineHeight: 1.7 }}>
                Payment information (processed securely through our payment providers).
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
              3. How We Use Your Information
            </h2>
            <p style={{ lineHeight: 1.7, color: '#a1a1aa', marginBottom: '12px' }}>
              We use your information to:
            </p>
            <ul style={{ listStyle: 'disc', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li style={{ color: '#a1a1aa', lineHeight: 1.7 }}>
                Provide and maintain our video generation service.
              </li>
              <li style={{ color: '#a1a1aa', lineHeight: 1.7 }}>
                Process your payments and manage your credit balance.
              </li>
              <li style={{ color: '#a1a1aa', lineHeight: 1.7 }}>
                Communicate with you about service updates or support.
              </li>
              <li style={{ color: '#a1a1aa', lineHeight: 1.7 }}>
                Improve our AI models and user experience.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
              4. Data Storage and Security
            </h2>
            <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
              We use industry-standard security measures to protect your data. Your account information is managed through secure authentication providers. Payment information is handled securely by our payment providers. We do not store your credit card details on our servers.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
              5. Third-Party Services
            </h2>
            <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
              We use third-party services for authentication and database management. These services have their own privacy policies which we encourage you to review.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
              6. Contact Us
            </h2>
            <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
              If you have any questions about this Privacy Policy, please contact us at <strong style={{ color: '#e5e5e5' }}>luoxiaoyu198961@gmail.com</strong>.
            </p>
          </section>
        </div>

        <p style={{ marginTop: '48px', color: '#71717a', fontSize: '14px' }}>
          Last updated: May 17, 2026
        </p>
      </div>
    </div>
  );
};
