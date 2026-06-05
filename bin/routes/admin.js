/**
 * Admin Routes
 * FAQ management (CRUD + reorder) and public FAQ listing.
 */

const express = require('express');
const { getAdminClient } = require('../utils/supabase-admin');
const { invalidateCache } = require('../seo/prerender-cache');

// ========== Admin Router (requires auth + admin) ==========

const adminRouter = express.Router();

/**
 * List all FAQs (including inactive), sorted by sort_order.
 * @route GET /api/admin/faqs
 */
adminRouter.get('/faqs', async (req, res) => {
  const supabase = getAdminClient();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ faqs: data });
});

/**
 * Create a new FAQ.
 * @route POST /api/admin/faqs
 * @body { question, answer, sort_order?, is_active? }
 */
adminRouter.post('/faqs', async (req, res) => {
  const supabase = getAdminClient();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { question, answer, sort_order, is_active } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: 'question and answer are required' });
  }

  // If sort_order not provided, put it at the end
  let order = sort_order;
  if (order === undefined || order === null) {
    const { data: maxOrder } = await supabase
      .from('faqs')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1);
    order = (maxOrder && maxOrder.length > 0) ? maxOrder[0].sort_order + 1 : 0;
  }

  const { data, error } = await supabase
    .from('faqs')
    .insert({ question, answer, sort_order: order, is_active: is_active !== undefined ? is_active : true })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  invalidateCache('/'); // homepage has FAQPage schema
  res.json({ faq: data });
});

/**
 * Update a FAQ.
 * @route PUT /api/admin/faqs/:id
 * @body { question?, answer?, sort_order?, is_active? }
 */
adminRouter.put('/faqs/:id', async (req, res) => {
  const supabase = getAdminClient();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { id } = req.params;
  const updates = {};

  if (req.body.question !== undefined) updates.question = req.body.question;
  if (req.body.answer !== undefined) updates.answer = req.body.answer;
  if (req.body.sort_order !== undefined) updates.sort_order = req.body.sort_order;
  if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;
  updates.updated_at = new Date().toISOString();

  if (Object.keys(updates).length === 1 && updates.updated_at) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const { data, error } = await supabase
    .from('faqs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'FAQ not found' });
  invalidateCache('/');
  res.json({ faq: data });
});

/**
 * Delete a FAQ.
 * @route DELETE /api/admin/faqs/:id
 */
adminRouter.delete('/faqs/:id', async (req, res) => {
  const supabase = getAdminClient();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { id } = req.params;
  const { error } = await supabase.from('faqs').delete().eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  invalidateCache('/');
  res.json({ success: true });
});

/**
 * Batch reorder FAQs.
 * @route PUT /api/admin/faqs/reorder
 * @body { items: [{ id, sort_order }] }
 */
adminRouter.put('/faqs/reorder', async (req, res) => {
  const supabase = getAdminClient();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }

  // Update each FAQ's sort_order
  for (const item of items) {
    if (!item.id || item.sort_order === undefined) continue;
    await supabase
      .from('faqs')
      .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
      .eq('id', item.id);
  }

  invalidateCache('/');
  res.json({ success: true });
});

/**
 * Invalidate cache — for use after direct database operations (e.g. SQL inserts).
 * @route POST /api/admin/cache/invalidate
 * @body { path?: string } — omit to flush all cache
 */
adminRouter.post('/cache/invalidate', (req, res) => {
  const { path } = req.body;
  invalidateCache(path || undefined);
  res.json({ success: true, invalidated: path || 'all' });
});

// ========== Public Router (no auth) ==========

const publicRouter = express.Router();

/**
 * Public FAQ list — only active items, sorted by sort_order.
 * @route GET /api/faqs
 */
publicRouter.get('/faqs', async (req, res) => {
  const supabase = getAdminClient();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { data, error } = await supabase
    .from('faqs')
    .select('id, question, answer, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ faqs: data });
});

module.exports = { adminRouter, publicRouter };
