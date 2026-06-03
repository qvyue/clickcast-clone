import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuthStore } from '../store/authStore';
import {
  FaqItem,
  adminFetchFaqs,
  adminCreateFaq,
  adminUpdateFaq,
  adminDeleteFaq,
  adminReorderFaqs,
} from '../api/client';
import './Admin.css';

export const Admin: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');

  // Create state
  const [showCreate, setShowCreate] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');

  // Saving state
  const [saving, setSaving] = useState(false);

  const loadFaqs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminFetchFaqs();
      setFaqs(data.faqs);
    } catch (e: any) {
      if (e.status === 403) {
        setForbidden(true);
      } else {
        setError(e.message || 'Failed to load FAQs');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/', { replace: true });
      return;
    }
    loadFaqs();
  }, [user, navigate, loadFaqs]);

  const handleCreate = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    try {
      setSaving(true);
      await adminCreateFaq({ question: newQuestion.trim(), answer: newAnswer.trim() });
      setNewQuestion('');
      setNewAnswer('');
      setShowCreate(false);
      await loadFaqs();
    } catch (e: any) {
      alert('Failed to create: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editQuestion.trim() || !editAnswer.trim()) return;
    try {
      setSaving(true);
      await adminUpdateFaq(id, { question: editQuestion.trim(), answer: editAnswer.trim() });
      setEditingId(null);
      await loadFaqs();
    } catch (e: any) {
      alert('Failed to update: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this FAQ?')) return;
    try {
      await adminDeleteFaq(id);
      await loadFaqs();
    } catch (e: any) {
      alert('Failed to delete: ' + e.message);
    }
  };

  const handleToggleActive = async (faq: FaqItem) => {
    try {
      await adminUpdateFaq(faq.id, { is_active: !faq.is_active });
      await loadFaqs();
    } catch (e: any) {
      alert('Failed to update: ' + e.message);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newFaqs = [...faqs];
    [newFaqs[index - 1], newFaqs[index]] = [newFaqs[index], newFaqs[index - 1]];
    const items = newFaqs.map((f, i) => ({ id: f.id, sort_order: i }));
    try {
      await adminReorderFaqs(items);
      await loadFaqs();
    } catch (e: any) {
      alert('Failed to reorder: ' + e.message);
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === faqs.length - 1) return;
    const newFaqs = [...faqs];
    [newFaqs[index], newFaqs[index + 1]] = [newFaqs[index + 1], newFaqs[index]];
    const items = newFaqs.map((f, i) => ({ id: f.id, sort_order: i }));
    try {
      await adminReorderFaqs(items);
      await loadFaqs();
    } catch (e: any) {
      alert('Failed to reorder: ' + e.message);
    }
  };

  const startEdit = (faq: FaqItem) => {
    setEditingId(faq.id);
    setEditQuestion(faq.question);
    setEditAnswer(faq.answer);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditQuestion('');
    setEditAnswer('');
  };

  if (forbidden) {
    return (
      <div className="admin-page">
        <Navbar variant="dashboard" />
        <div className="admin-container">
          <div className="admin-forbidden">
            <h2>Access Denied</h2>
            <p>You don't have permission to access the admin panel.</p>
            <button onClick={() => navigate('/')} className="admin-btn admin-btn-secondary">Back to Home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <Navbar variant="dashboard" />

      <div className="admin-container">
        <div className="admin-header">
          <h1 className="admin-title">Admin Panel</h1>
          <p className="admin-subtitle">Manage your site content</p>
        </div>

        {/* Tab navigation */}
        <div className="admin-tabs">
          <button className="admin-tab active">Common Questions</button>
        </div>

        {/* FAQ Management */}
        <div className="admin-section">
          <div className="admin-section-header">
            <h2>FAQs</h2>
            <button
              className="admin-btn admin-btn-primary"
              onClick={() => setShowCreate(true)}
              disabled={showCreate}
            >
              + Add FAQ
            </button>
          </div>

          {/* Create form */}
          {showCreate && (
            <div className="admin-card admin-edit-card">
              <div className="admin-edit-field">
                <label>Question</label>
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Enter question..."
                  className="admin-input"
                />
              </div>
              <div className="admin-edit-field">
                <label>Answer</label>
                <textarea
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="Enter answer..."
                  className="admin-textarea"
                  rows={3}
                />
              </div>
              <div className="admin-edit-actions">
                <button className="admin-btn admin-btn-primary" onClick={handleCreate} disabled={saving || !newQuestion.trim() || !newAnswer.trim()}>
                  {saving ? 'Saving...' : 'Create'}
                </button>
                <button className="admin-btn admin-btn-secondary" onClick={() => { setShowCreate(false); setNewQuestion(''); setNewAnswer(''); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* FAQ list */}
          {loading ? (
            <div className="admin-loading">Loading...</div>
          ) : error ? (
            <div className="admin-error">{error}</div>
          ) : faqs.length === 0 ? (
            <div className="admin-empty">No FAQs yet. Click "Add FAQ" to create one.</div>
          ) : (
            <div className="admin-faq-list">
              {faqs.map((faq, index) => (
                <div key={faq.id} className={`admin-card admin-faq-card ${!faq.is_active ? 'admin-faq-inactive' : ''}`}>
                  {editingId === faq.id ? (
                    // Edit mode
                    <>
                      <div className="admin-edit-field">
                        <label>Question</label>
                        <input
                          type="text"
                          value={editQuestion}
                          onChange={(e) => setEditQuestion(e.target.value)}
                          className="admin-input"
                        />
                      </div>
                      <div className="admin-edit-field">
                        <label>Answer</label>
                        <textarea
                          value={editAnswer}
                          onChange={(e) => setEditAnswer(e.target.value)}
                          className="admin-textarea"
                          rows={3}
                        />
                      </div>
                      <div className="admin-edit-actions">
                        <button className="admin-btn admin-btn-primary" onClick={() => handleUpdate(faq.id)} disabled={saving}>
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button className="admin-btn admin-btn-secondary" onClick={cancelEdit}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    // View mode
                    <>
                      <div className="admin-faq-content">
                        <div className="admin-faq-question">
                          <span className="admin-faq-order">#{faq.sort_order}</span>
                          {faq.question}
                          {!faq.is_active && <span className="admin-faq-badge">Hidden</span>}
                        </div>
                        <div className="admin-faq-answer">{faq.answer}</div>
                      </div>
                      <div className="admin-faq-actions">
                        <button
                          className="admin-btn-icon"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          title="Move up"
                        >↑</button>
                        <button
                          className="admin-btn-icon"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === faqs.length - 1}
                          title="Move down"
                        >↓</button>
                        <button
                          className="admin-btn-icon"
                          onClick={() => handleToggleActive(faq)}
                          title={faq.is_active ? 'Hide' : 'Show'}
                        >{faq.is_active ? '👁' : '👁‍🗨'}</button>
                        <button className="admin-btn-icon" onClick={() => startEdit(faq)} title="Edit">✏️</button>
                        <button className="admin-btn-icon admin-btn-danger" onClick={() => handleDelete(faq.id)} title="Delete">🗑</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};
