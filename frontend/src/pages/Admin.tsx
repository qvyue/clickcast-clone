import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuthStore } from '../store/authStore';
import {
  FaqItem,
  BlogPost,
  adminFetchFaqs,
  adminCreateFaq,
  adminUpdateFaq,
  adminDeleteFaq,
  adminReorderFaqs,
  adminFetchBlogPosts,
  adminCreateBlogPost,
  adminUpdateBlogPost,
  adminDeleteBlogPost,
} from '../api/client';
import './Admin.css';

type TabKey = 'faqs' | 'blog';

export const Admin: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<TabKey>('faqs');
  const [forbidden, setForbidden] = useState(false);

  // ===== FAQ state =====
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [faqLoading, setFaqLoading] = useState(true);
  const [faqError, setFaqError] = useState<string | null>(null);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [editFaqQuestion, setEditFaqQuestion] = useState('');
  const [editFaqAnswer, setEditFaqAnswer] = useState('');
  const [showCreateFaq, setShowCreateFaq] = useState(false);
  const [newFaqQuestion, setNewFaqQuestion] = useState('');
  const [newFaqAnswer, setNewFaqAnswer] = useState('');
  const [saving, setSaving] = useState(false);

  // ===== Blog state =====
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [blogLoading, setBlogLoading] = useState(true);
  const [blogError, setBlogError] = useState<string | null>(null);
  const [editingBlogId, setEditingBlogId] = useState<string | null>(null);
  const [showCreateBlog, setShowCreateBlog] = useState(false);
  const [blogForm, setBlogForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    cover_image_url: '',
    category: 'Guides',
    author: 'VidGen Team',
    read_time: 5,
    is_active: true,
  });

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  // ===== FAQ handlers =====
  const loadFaqs = useCallback(async () => {
    try {
      setFaqLoading(true);
      setFaqError(null);
      const data = await adminFetchFaqs();
      setFaqs(data.faqs);
    } catch (e: any) {
      if (e.status === 403) { setForbidden(true); return; }
      setFaqError(e.message || 'Failed to load FAQs');
    } finally {
      setFaqLoading(false);
    }
  }, []);

  const handleCreateFaq = async () => {
    if (!newFaqQuestion.trim() || !newFaqAnswer.trim()) return;
    try {
      setSaving(true);
      await adminCreateFaq({ question: newFaqQuestion.trim(), answer: newFaqAnswer.trim() });
      setNewFaqQuestion('');
      setNewFaqAnswer('');
      setShowCreateFaq(false);
      await loadFaqs();
    } catch (e: any) {
      alert('Failed to create: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateFaq = async (id: string) => {
    if (!editFaqQuestion.trim() || !editFaqAnswer.trim()) return;
    try {
      setSaving(true);
      await adminUpdateFaq(id, { question: editFaqQuestion.trim(), answer: editFaqAnswer.trim() });
      setEditingFaqId(null);
      await loadFaqs();
    } catch (e: any) {
      alert('Failed to update: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!confirm('Delete this FAQ?')) return;
    try {
      await adminDeleteFaq(id);
      await loadFaqs();
    } catch (e: any) {
      alert('Failed to delete: ' + e.message);
    }
  };

  const handleToggleFaqActive = async (faq: FaqItem) => {
    try {
      await adminUpdateFaq(faq.id, { is_active: !faq.is_active });
      await loadFaqs();
    } catch (e: any) {
      alert('Failed to update: ' + e.message);
    }
  };

  const handleMoveFaqUp = async (index: number) => {
    if (index === 0) return;
    const newFaqs = [...faqs];
    [newFaqs[index - 1], newFaqs[index]] = [newFaqs[index], newFaqs[index - 1]];
    const items = newFaqs.map((f, i) => ({ id: f.id, sort_order: i }));
    try { await adminReorderFaqs(items); await loadFaqs(); } catch (e: any) { alert(e.message); }
  };

  const handleMoveFaqDown = async (index: number) => {
    if (index === faqs.length - 1) return;
    const newFaqs = [...faqs];
    [newFaqs[index], newFaqs[index + 1]] = [newFaqs[index + 1], newFaqs[index]];
    const items = newFaqs.map((f, i) => ({ id: f.id, sort_order: i }));
    try { await adminReorderFaqs(items); await loadFaqs(); } catch (e: any) { alert(e.message); }
  };

  // ===== Blog handlers =====
  const loadBlogPosts = useCallback(async () => {
    try {
      setBlogLoading(true);
      setBlogError(null);
      const data = await adminFetchBlogPosts();
      setBlogPosts(data.posts);
    } catch (e: any) {
      if (e.status === 403) { setForbidden(true); return; }
      setBlogError(e.message || 'Failed to load blog posts');
    } finally {
      setBlogLoading(false);
    }
  }, []);

  const resetBlogForm = () => {
    setBlogForm({ title: '', slug: '', excerpt: '', content: '', cover_image_url: '', category: 'Guides', author: 'VidGen Team', read_time: 5, is_active: true });
  };

  const handleCreateBlog = async () => {
    if (!blogForm.title.trim() || !blogForm.slug.trim() || !blogForm.content.trim()) return;
    try {
      setSaving(true);
      await adminCreateBlogPost({
        title: blogForm.title.trim(),
        slug: blogForm.slug.trim(),
        excerpt: blogForm.excerpt.trim() || undefined,
        content: blogForm.content.trim(),
        cover_image_url: blogForm.cover_image_url.trim() || undefined,
        category: blogForm.category || undefined,
        author: blogForm.author || undefined,
        read_time: blogForm.read_time || undefined,
        is_active: blogForm.is_active,
      });
      resetBlogForm();
      setShowCreateBlog(false);
      await loadBlogPosts();
    } catch (e: any) {
      alert('Failed to create: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateBlog = async (id: string) => {
    if (!blogForm.title.trim() || !blogForm.content.trim()) return;
    try {
      setSaving(true);
      await adminUpdateBlogPost(id, {
        title: blogForm.title.trim(),
        slug: blogForm.slug.trim() || undefined,
        excerpt: blogForm.excerpt.trim() || undefined,
        content: blogForm.content.trim(),
        cover_image_url: blogForm.cover_image_url.trim() || undefined,
        category: blogForm.category || undefined,
        author: blogForm.author || undefined,
        read_time: blogForm.read_time || undefined,
        is_active: blogForm.is_active,
      });
      setEditingBlogId(null);
      await loadBlogPosts();
    } catch (e: any) {
      alert('Failed to update: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlog = async (id: string) => {
    if (!confirm('Delete this blog post?')) return;
    try { await adminDeleteBlogPost(id); await loadBlogPosts(); } catch (e: any) { alert(e.message); }
  };

  const handleToggleBlogActive = async (post: BlogPost) => {
    try { await adminUpdateBlogPost(post.id, { is_active: !post.is_active }); await loadBlogPosts(); } catch (e: any) { alert(e.message); }
  };

  const startEditBlog = (post: BlogPost) => {
    setEditingBlogId(post.id);
    setBlogForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || '',
      content: post.content,
      cover_image_url: post.cover_image_url || '',
      category: post.category,
      author: post.author,
      read_time: post.read_time,
      is_active: post.is_active,
    });
  };

  const cancelEditBlog = () => {
    setEditingBlogId(null);
    resetBlogForm();
  };

  // ===== Init =====
  useEffect(() => {
    if (!user) { navigate('/', { replace: true }); return; }
    loadFaqs();
    loadBlogPosts();
  }, [user, navigate, loadFaqs, loadBlogPosts]);

  // ===== Blog edit form component =====
  const blogEditForm = (isNew: boolean) => (
    <>
      <div className="admin-edit-row">
        <div className="admin-edit-field">
          <label>Title</label>
          <input type="text" value={blogForm.title} onChange={(e) => setBlogForm(f => ({ ...f, title: e.target.value }))} placeholder="Post title..." className="admin-input" />
        </div>
        <div className="admin-edit-field">
          <label>Slug</label>
          <input type="text" value={blogForm.slug} onChange={(e) => setBlogForm(f => ({ ...f, slug: e.target.value }))} placeholder="url-friendly-slug" className="admin-input" />
        </div>
      </div>
      <div className="admin-edit-field">
        <label>Excerpt</label>
        <textarea value={blogForm.excerpt} onChange={(e) => setBlogForm(f => ({ ...f, excerpt: e.target.value }))} placeholder="Short summary..." className="admin-textarea" rows={2} />
      </div>
      <div className="admin-edit-field">
        <label>Content (Markdown)</label>
        <textarea value={blogForm.content} onChange={(e) => setBlogForm(f => ({ ...f, content: e.target.value }))} placeholder="Write your post content in Markdown..." className="admin-textarea admin-textarea-tall" rows={12} />
      </div>
      <div className="admin-edit-row">
        <div className="admin-edit-field">
          <label>Cover Image URL</label>
          <input type="text" value={blogForm.cover_image_url} onChange={(e) => setBlogForm(f => ({ ...f, cover_image_url: e.target.value }))} placeholder="https://..." className="admin-input" />
        </div>
        <div className="admin-edit-field">
          <label>Category</label>
          <input type="text" value={blogForm.category} onChange={(e) => setBlogForm(f => ({ ...f, category: e.target.value }))} placeholder="Guides" className="admin-input" />
        </div>
      </div>
      <div className="admin-edit-row">
        <div className="admin-edit-field">
          <label>Author</label>
          <input type="text" value={blogForm.author} onChange={(e) => setBlogForm(f => ({ ...f, author: e.target.value }))} placeholder="VidGen Team" className="admin-input" />
        </div>
        <div className="admin-edit-field">
          <label>Read Time (min)</label>
          <input type="number" value={blogForm.read_time} onChange={(e) => setBlogForm(f => ({ ...f, read_time: parseInt(e.target.value) || 5 }))} min={1} className="admin-input" />
        </div>
      </div>
      <div className="admin-edit-field">
        <label>
          <input type="checkbox" checked={blogForm.is_active} onChange={(e) => setBlogForm(f => ({ ...f, is_active: e.target.checked }))} style={{ marginRight: '0.4rem' }} />
          Published (Active)
        </label>
      </div>
      <div className="admin-edit-actions">
        <button className="admin-btn admin-btn-primary" onClick={isNew ? handleCreateBlog : () => editingBlogId && handleUpdateBlog(editingBlogId)} disabled={saving || !blogForm.title.trim() || !blogForm.content.trim()}>
          {saving ? 'Saving...' : isNew ? 'Create' : 'Save'}
        </button>
        <button className="admin-btn admin-btn-secondary" onClick={isNew ? () => { setShowCreateBlog(false); resetBlogForm(); } : cancelEditBlog}>
          Cancel
        </button>
      </div>
    </>
  );

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
          <button className={`admin-tab ${activeTab === 'faqs' ? 'active' : ''}`} onClick={() => setActiveTab('faqs')}>Common Questions</button>
          <button className={`admin-tab ${activeTab === 'blog' ? 'active' : ''}`} onClick={() => setActiveTab('blog')}>Blog Posts</button>
        </div>

        {/* ===== FAQ Tab ===== */}
        {activeTab === 'faqs' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>FAQs</h2>
              <button className="admin-btn admin-btn-primary" onClick={() => setShowCreateFaq(true)} disabled={showCreateFaq}>+ Add FAQ</button>
            </div>

            {showCreateFaq && (
              <div className="admin-card admin-edit-card">
                <div className="admin-edit-field">
                  <label>Question</label>
                  <input type="text" value={newFaqQuestion} onChange={(e) => setNewFaqQuestion(e.target.value)} placeholder="Enter question..." className="admin-input" />
                </div>
                <div className="admin-edit-field">
                  <label>Answer</label>
                  <textarea value={newFaqAnswer} onChange={(e) => { setNewFaqAnswer(e.target.value); autoResize(e.target); }} placeholder="Enter answer..." className="admin-textarea admin-faq-auto-textarea" rows={3} ref={autoResize} />
                </div>
                <div className="admin-edit-actions">
                  <button className="admin-btn admin-btn-primary" onClick={handleCreateFaq} disabled={saving || !newFaqQuestion.trim() || !newFaqAnswer.trim()}>{saving ? 'Saving...' : 'Create'}</button>
                  <button className="admin-btn admin-btn-secondary" onClick={() => { setShowCreateFaq(false); setNewFaqQuestion(''); setNewFaqAnswer(''); }}>Cancel</button>
                </div>
              </div>
            )}

            {faqLoading ? (
              <div className="admin-loading">Loading...</div>
            ) : faqError ? (
              <div className="admin-error">{faqError}</div>
            ) : faqs.length === 0 ? (
              <div className="admin-empty">No FAQs yet. Click "Add FAQ" to create one.</div>
            ) : (
              <div className="admin-faq-list">
                {faqs.map((faq, index) => (
                  <div key={faq.id} className={`admin-card admin-faq-card ${!faq.is_active ? 'admin-faq-inactive' : ''}`}>
                    {editingFaqId === faq.id ? (
                      <>
                        <div className="admin-edit-field">
                          <label>Question</label>
                          <input type="text" value={editFaqQuestion} onChange={(e) => setEditFaqQuestion(e.target.value)} className="admin-input" />
                        </div>
                        <div className="admin-edit-field">
                          <label>Answer</label>
                          <textarea value={editFaqAnswer} onChange={(e) => { setEditFaqAnswer(e.target.value); autoResize(e.target); }} className="admin-textarea admin-faq-auto-textarea" rows={3} ref={autoResize} />
                        </div>
                        <div className="admin-edit-actions">
                          <button className="admin-btn admin-btn-primary" onClick={() => handleUpdateFaq(faq.id)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="admin-btn admin-btn-secondary" onClick={() => { setEditingFaqId(null); setEditFaqQuestion(''); setEditFaqAnswer(''); }}>Cancel</button>
                        </div>
                      </>
                    ) : (
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
                          <button className="admin-btn-icon" onClick={() => handleMoveFaqUp(index)} disabled={index === 0} title="Move up">↑</button>
                          <button className="admin-btn-icon" onClick={() => handleMoveFaqDown(index)} disabled={index === faqs.length - 1} title="Move down">↓</button>
                          <button className="admin-btn-icon" onClick={() => handleToggleFaqActive(faq)} title={faq.is_active ? 'Hide' : 'Show'}>{faq.is_active ? '👁' : '👁‍🗨'}</button>
                          <button className="admin-btn-icon" onClick={() => { setEditingFaqId(faq.id); setEditFaqQuestion(faq.question); setEditFaqAnswer(faq.answer); }} title="Edit">✏️</button>
                          <button className="admin-btn-icon admin-btn-danger" onClick={() => handleDeleteFaq(faq.id)} title="Delete">🗑</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== Blog Tab ===== */}
        {activeTab === 'blog' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Blog Posts</h2>
              <button className="admin-btn admin-btn-primary" onClick={() => { setShowCreateBlog(true); resetBlogForm(); }} disabled={showCreateBlog}>+ Add Post</button>
            </div>

            {showCreateBlog && (
              <div className="admin-card admin-edit-card">
                {blogEditForm(true)}
              </div>
            )}

            {blogLoading ? (
              <div className="admin-loading">Loading...</div>
            ) : blogError ? (
              <div className="admin-error">{blogError}</div>
            ) : blogPosts.length === 0 ? (
              <div className="admin-empty">No blog posts yet. Click "Add Post" to create one.</div>
            ) : (
              <div className="admin-blog-list">
                {blogPosts.map((post) => (
                  <div key={post.id} className={`admin-card admin-blog-card ${!post.is_active ? 'admin-blog-inactive' : ''}`}>
                    {editingBlogId === post.id ? (
                      blogEditForm(false)
                    ) : (
                      <>
                        <div className="admin-blog-content">
                          <div className="admin-blog-title">
                            {post.title}
                            {!post.is_active && <span className="admin-faq-badge">Hidden</span>}
                          </div>
                          <span className="admin-blog-slug">/{post.slug}</span>
                          <div className="admin-blog-meta-row">
                            <span className="admin-blog-badge">{post.category}</span>
                            <span>{post.author}</span>
                            <span>{post.read_time} min</span>
                            <span>{new Date(post.published_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="admin-blog-actions">
                          <button className="admin-btn-icon" onClick={() => handleToggleBlogActive(post)} title={post.is_active ? 'Hide' : 'Show'}>{post.is_active ? '👁' : '👁‍🗨'}</button>
                          <button className="admin-btn-icon" onClick={() => startEditBlog(post)} title="Edit">✏️</button>
                          <button className="admin-btn-icon admin-btn-danger" onClick={() => handleDeleteBlog(post.id)} title="Delete">🗑</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};
