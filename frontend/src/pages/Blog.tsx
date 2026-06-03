import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { fetchBlogPosts } from '../api/client';
import './Blog.css';

interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category: string;
  author: string;
  read_time: number;
  published_at: string;
}

export const BlogPage: React.FC = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchBlogPosts()
      .then((data) => setPosts(data.posts))
      .catch((e) => setError(e.message || 'Failed to load blog posts'))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="blog-page">
      <Navbar variant="home" />

      <div className="blog-hero">
        <h1 className="blog-hero-title">Our Blog</h1>
        <p className="blog-hero-subtitle">
          Insights, guides, and tips on creating stunning videos from your website.
        </p>
      </div>

      <div className="blog-container">
        {loading ? (
          <div className="blog-loading">Loading...</div>
        ) : error ? (
          <div className="blog-error">{error}</div>
        ) : posts.length === 0 ? (
          <div className="blog-empty">No blog posts yet. Stay tuned!</div>
        ) : (
          <div className="blog-grid">
            {posts.map((post) => (
              <div
                key={post.id}
                className="blog-card"
                onClick={() => navigate(`/blog/${post.slug}`)}
              >
                {post.cover_image_url && (
                  <div className="blog-card-image">
                    <img src={post.cover_image_url} alt={post.title} loading="lazy" />
                    <span className="blog-card-category">{post.category}</span>
                  </div>
                )}
                {!post.cover_image_url && (
                  <div className="blog-card-image" style={{ background: 'var(--bg-elevated)' }}>
                    <span className="blog-card-category">{post.category}</span>
                  </div>
                )}
                <div className="blog-card-body">
                  <div className="blog-card-meta">
                    <span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {formatDate(post.published_at)}
                    </span>
                    <span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {post.read_time} min read
                    </span>
                  </div>
                  <h2 className="blog-card-title">{post.title}</h2>
                  {post.excerpt && <p className="blog-card-excerpt">{post.excerpt}</p>}
                  <div className="blog-card-footer">
                    <span className="blog-card-author">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      {post.author}
                    </span>
                    <span className="blog-card-read">
                      Read Article
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};
