import React from 'react';
import { useNavigate } from 'react-router-dom';

export const TermsPage: React.FC = () => {
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
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#fff' }}>Terms of Service</h1>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
              1. Acceptance of Terms
            </h2>
            <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
              By accessing or using VidGen, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
              2. Description of Service
            </h2>
            <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
              VidGen is an AI-powered video generation tool that transforms website URLs into marketing videos. We provide a subscription-based service.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
              3. User Accounts
            </h2>
            <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
              You must create an account to use VidGen. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
              4. Subscriptions and Payments
            </h2>
            <p style={{ lineHeight: 1.7, color: '#a1a1aa', marginBottom: '12px' }}>
              VidGen operates on a subscription basis. By subscribing, you agree to the following:
            </p>
            <ul style={{ listStyle: 'disc', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li style={{ color: '#a1a1aa', lineHeight: 1.7 }}>
                <strong style={{ color: '#e5e5e5' }}>Subscriptions:</strong> By subscribing, you agree to a paid monthly subscription. Your account will automatically renew each month unless cancelled.
              </li>
              <li style={{ color: '#a1a1aa', lineHeight: 1.7 }}>
                <strong style={{ color: '#e5e5e5' }}>Free Trial:</strong> New users may be eligible for a free trial period. Trial credits are limited and do not roll over. After the trial, a paid subscription is required to continue generating videos.
              </li>
              <li style={{ color: '#a1a1aa', lineHeight: 1.7 }}>
                <strong style={{ color: '#e5e5e5' }}>Video Credits:</strong> Each plan includes a specific number of video generations per month. Unused credits do not roll over to the next billing cycle.
              </li>
              <li style={{ color: '#a1a1aa', lineHeight: 1.7 }}>
                <strong style={{ color: '#e5e5e5' }}>Payment Processing:</strong> All payments are processed securely. We do not store your credit card information.
              </li>
              <li style={{ color: '#a1a1aa', lineHeight: 1.7 }}>
                <strong style={{ color: '#e5e5e5' }}>Cancellations:</strong> You can cancel your subscription at any time. Upon cancellation, your access (including remaining video credits) will continue until the end of your current billing period. You will not be charged again.
              </li>
              <li style={{ color: '#a1a1aa', lineHeight: 1.7 }}>
                <strong style={{ color: '#e5e5e5' }}>Refunds:</strong> Payments are generally non-refundable. Even in the case the output video didn&apos;t meet your expectations we are not responsible for refunding any amount whether it&apos;s subscription money or one time payment. Please be sure to cancel your trial before it&apos;s charged for the next month if you don&apos;t want to continue with the service. Please contact support if you believe there has been a billing error.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
              5. Acceptable Use
            </h2>
            <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
              You agree not to use VidGen to generate content that is illegal, harmful, defamatory, or infringes on third-party intellectual property rights. We reserve the right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
              6. Limitation of Liability
            </h2>
            <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
              VidGen is provided &quot;as is&quot; without any warranties. We shall not be liable for any indirect, incidental, or consequential damages resulting from the use or inability to use our service.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
              7. Video Retention Policy
            </h2>
            <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
              Generated videos are temporary and intended for immediate download. Videos will be automatically deleted from our servers 48 hours after they are successfully generated. It is your responsibility to download your videos before they expire.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
              8. Contact Us
            </h2>
            <p style={{ lineHeight: 1.7, color: '#a1a1aa' }}>
              For any further help, questions, or concerns regarding these Terms, please contact us at <strong style={{ color: '#e5e5e5' }}>luoxiaoyu198961@gmail.com</strong>.
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
