/**
 * Blog Routes
 * Blog post management (CRUD) and public blog listing.
 */

const express = require('express');
const { getAdminClient } = require('../utils/supabase-admin');

// ========== Admin Router (requires auth + admin) ==========

const adminBlogRouter = express.Router();

/**
 * List all blog posts (including inactive), sorted by published_at desc.
 * @route GET /api/admin/blog
 */
adminBlogRouter.get('/', async (req, res) => {
  const supabase = getAdminClient();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('published_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ posts: data });
});

/**
 * Create a new blog post.
 * @route POST /api/admin/blog
 * @body { title, slug, excerpt?, content, cover_image_url?, category?, author?, read_time?, is_active? }
 */
adminBlogRouter.post('/', async (req, res) => {
  const supabase = getAdminClient();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { title, slug, excerpt, content, cover_image_url, category, author, read_time, is_active } = req.body;

  if (!title || !slug || !content) {
    return res.status(400).json({ error: 'title, slug, and content are required' });
  }

  const insert = {
    title,
    slug,
    content,
    excerpt: excerpt || null,
    cover_image_url: cover_image_url || null,
    category: category || 'Guides',
    author: author || 'VidGen Team',
    read_time: read_time || 5,
    is_active: is_active !== undefined ? is_active : true,
  };

  const { data, error } = await supabase
    .from('blog_posts')
    .insert(insert)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A blog post with this slug already exists' });
    }
    return res.status(500).json({ error: error.message });
  }
  res.json({ post: data });
});

/**
 * Update a blog post.
 * @route PUT /api/admin/blog/:id
 * @body { title?, slug?, excerpt?, content?, cover_image_url?, category?, author?, read_time?, is_active? }
 */
adminBlogRouter.put('/:id', async (req, res) => {
  const supabase = getAdminClient();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { id } = req.params;
  const updates = {};

  if (req.body.title !== undefined) updates.title = req.body.title;
  if (req.body.slug !== undefined) updates.slug = req.body.slug;
  if (req.body.excerpt !== undefined) updates.excerpt = req.body.excerpt;
  if (req.body.content !== undefined) updates.content = req.body.content;
  if (req.body.cover_image_url !== undefined) updates.cover_image_url = req.body.cover_image_url;
  if (req.body.category !== undefined) updates.category = req.body.category;
  if (req.body.author !== undefined) updates.author = req.body.author;
  if (req.body.read_time !== undefined) updates.read_time = req.body.read_time;
  if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;
  updates.updated_at = new Date().toISOString();

  if (Object.keys(updates).length === 1 && updates.updated_at) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A blog post with this slug already exists' });
    }
    return res.status(500).json({ error: error.message });
  }
  if (!data) return res.status(404).json({ error: 'Blog post not found' });
  res.json({ post: data });
});

/**
 * Delete a blog post.
 * @route DELETE /api/admin/blog/:id
 */
adminBlogRouter.delete('/:id', async (req, res) => {
  const supabase = getAdminClient();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { id } = req.params;
  const { error } = await supabase.from('blog_posts').delete().eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ========== Public Router (no auth) ==========

const publicBlogRouter = express.Router();

/**
 * Public blog list — only active posts, sorted by published_at desc.
 * @route GET /api/blog
 */
publicBlogRouter.get('/', async (req, res) => {
  const supabase = getAdminClient();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, title, slug, excerpt, cover_image_url, category, author, read_time, published_at')
    .eq('is_active', true)
    .order('published_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ posts: data });
});

/**
 * Public blog post detail — by slug, only active posts.
 * @route GET /api/blog/:slug
 */
publicBlogRouter.get('/:slug', async (req, res) => {
  const supabase = getAdminClient();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { slug } = req.params;
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Blog post not found' });
  res.json({ post: data });
});

module.exports = { adminBlogRouter, publicBlogRouter };
