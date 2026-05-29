import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import { useAuthStore } from '../store/authStore';
import { useBillingStore } from '../store/billingStore';
import { fetchWithTimeout, deleteVideo } from '../api/client';
import type { CreditTransaction } from '../api/client';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

const TYPE_LABELS: Record<string, string> = {
  generation: 'Video Generation',
  render: 'Video Render',
  refund: 'Refund',
  pro_subscription: 'Pro Subscription',
  credit_pack: 'Credit Pack',
  monthly_grant: 'Monthly Grant',
};

export const Dashboard: React.FC = () => {
  const [videos, setVideos] = useState<any[]>([]);
  const navigate = useNavigate();
  const billing = useBillingStore();
  const user = useAuthStore((s) => s.user);
  const userId = useAuthStore((s) => s.user?.id);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    if (!loading && !userId) {
      navigate('/', { replace: true });
      return;
    }
    if (!userId) return;

    let stale = false;

    billing.refresh();
    billing.fetchTransactions();

    fetchWithTimeout('/api/videos')
      .then(res => res.json())
      .then(data => {
        if (!stale && data.videos) {
          setVideos(data.videos);
        }
      })
      .catch(e => {
        if (!stale) console.error('Failed to load video list:', e);
      });

    return () => { stale = true; };
  }, [userId, loading]);

  if (loading || !user) {
    return <div className="dashboard-loading">Loading...</div>;
  }

  const sub = billing.subscription;
  const hasSubscription = sub && (sub.status === 'active' || sub.status === 'trialing');
  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

  return (
    <div className="dashboard-page">
      <Navbar variant="dashboard" />
      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <div className="dashboard-header-left">
            <h1 className="dashboard-title">Dashboard</h1>
            <p className="dashboard-subtitle">Welcome back, {userName}</p>
          </div>
          <div className="dashboard-header-right">
            {/* Credit card */}
            <div className="credit-card">
              <div className="credit-card-label">
                {hasSubscription ? (sub.status === 'trialing' ? 'Pro (Trial)' : 'Pro') : billing.credits > 0 ? 'Pay-as-you-go' : 'Free'}
              </div>
              <div className="credit-card-balance">
                <span className="credit-card-amount">{billing.credits}</span>
                <span className="credit-card-unit">credits</span>
              </div>
              <div className="credit-card-action">
                {hasSubscription ? (
                  <button onClick={() => billing.openPortal()} className="credit-card-link">Manage</button>
                ) : (
                  <button onClick={() => billing.startCheckout('pro')} className="credit-card-link">Start Trial</button>
                )}
              </div>
            </div>
            {/* New Video button */}
            <a href="/" className="btn-new-video">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              New Video
            </a>
          </div>
        </div>

        {/* Subscription alert */}
        {!hasSubscription && (
          <div className="dashboard-alert">
            <div className="dashboard-alert-content">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div>
                <p className="alert-title">No active subscription</p>
                <p className="alert-desc">Start a free trial to begin creating videos.</p>
              </div>
            </div>
            <button onClick={() => billing.startCheckout('pro')} className="btn-start-trial">Start Trial</button>
          </div>
        )}
        {hasSubscription && sub?.status === 'trialing' && sub.trial_end && new Date(sub.trial_end) > new Date() && (
          <div className="dashboard-alert alert-info">
            <div className="dashboard-alert-content">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <div>
                <p className="alert-title">Free trial — {Math.ceil((new Date(sub.trial_end).getTime() - Date.now()) / 86400000)} days left</p>
                <p className="alert-desc">Your Pro subscription will begin billing after the trial ends.</p>
              </div>
            </div>
            <button onClick={() => billing.openPortal()} className="btn-start-trial">Manage</button>
          </div>
        )}

        {/* Videos Section */}
        <div className="dashboard-section">
          <h2 className="dashboard-section-title">Your Videos</h2>
          {videos.length > 0 ? (
            <div className="videos-grid">
              {videos.map((v: any) => (
                <div key={v.domain} className="video-card">
                  <div className="video-card-header">
                    <span className="video-domain">{v.domain}</span>
                    <span className="video-size">{v.size} MB</span>
                  </div>
                  <div className="video-card-actions">
                    <button onClick={() => navigate(`/editor/${v.domain}`)} className="btn-secondary">Edit</button>
                    <a href={v.url} target="_blank" rel="noreferrer" className="btn-secondary">Play</a>
                    <a href={v.url.startsWith('/') ? v.url : `/api/download?url=${encodeURIComponent(v.url)}&name=${v.domain}.mp4`} download className="btn-primary-sm">Download</a>
                    <button onClick={() => { deleteVideo(v.domain).then(() => setVideos(prev => prev.filter(vv => vv.domain !== v.domain))).catch(() => {}) }} className="btn-danger-sm">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <h3>No videos yet</h3>
              <p>Create your first marketing video to get started</p>
            </div>
          )}
        </div>

        {/* Credit Transactions */}
        <div className="dashboard-section">
          <h2 className="dashboard-section-title">Credit History</h2>
          {billing.transactions.length > 0 ? (
            <div className="transactions-table-wrapper">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.transactions.map((t: CreditTransaction) => (
                    <tr key={t.id}>
                      <td className="td-date">{new Date(t.created_at).toLocaleDateString()} {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="td-type">{TYPE_LABELS[t.type] || t.type}</td>
                      <td className={t.amount > 0 ? 'td-amount positive' : 'td-amount negative'}>
                        {t.amount > 0 ? '+' : ''}{t.amount}
                      </td>
                      <td className="td-balance">{t.balance_after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
              <h3>No transactions yet</h3>
              <p>Your credit history will appear here</p>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};
