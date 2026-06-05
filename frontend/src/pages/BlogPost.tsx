import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { fetchBlogPost, BlogPost as BlogPostType } from '../api/client';
import './BlogPost.css';

export const BlogPostPage: React.FC = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!slug) return;
    fetchBlogPost(slug)
      .then((data) => setPost(data.post))
      .catch((e) => setError(e.message || 'Failed to load blog post'))
      .finally(() => setLoading(false));
  }, [slug]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="blogpost-page">
        <Navbar variant="home" />
        <div className="blogpost-loading">Loading...</div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="blogpost-page">
        <Navbar variant="home" />
        <div className="blogpost-error">
          <h2>Post Not Found</h2>
          <p>{error || 'The blog post you are looking for does not exist.'}</p>
          <button onClick={() => navigate('/blog')} className="admin-btn admin-btn-secondary">Back to Blog</button>
        </div>
      </div>
    );
  }

  return (
    <div className="blogpost-page">
      <Navbar variant="home" />

      <div className="blogpost-container">
        <a className="blogpost-back" onClick={() => navigate('/blog')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to Blog
        </a>

        {post.cover_image_url && (
          <img src={post.cover_image_url} alt={post.title} className="blogpost-cover" />
        )}

        <div className="blogpost-header">
          <h1 className="blogpost-title">{post.title}</h1>
          <div className="blogpost-meta">
            <span className="blogpost-category-badge">{post.category}</span>
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {formatDate(post.published_at)}
            </span>
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {post.read_time} min read
            </span>
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {post.author}
            </span>
          </div>
        </div>

        <div className="blogpost-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </div>
      </div>

      <Footer />
    </div>
  );
};
