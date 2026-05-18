/**
 * Shared state and utilities for VidGen Web Server
 */

const fs = require('fs');
const path = require('path');

// ========== Global State Storage ==========

/**
 * Job status map, key is jobId
 *
 * ⚠️ 风险提示：Job 存储在内存 Map 中，服务重启后丢失
 * 生产环境建议改用 Redis 或数据库持久化，避免渲染中的任务状态丢失
 *
 * Job 对象结构：
 * - status: 'pending' | 'rendering' | 'completed' | 'failed'
 * - progress: 0-100 进度百分比
 * - message: 状态消息
 * - domain: 网站域名
 * - aspectRatio: 'landscape' | 'portrait'
 * - createdAt: 创建时间戳
 */
const jobs = new Map();

/** @type {Map<string, string>} R2 video URL cache */
const r2VideoUrls = new Map();

/** @type {Map<string, Object>} IP request rate limiter */
const rateLimiter = new Map();

/** @type {string} Internal API secret for request validation */
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
if (!INTERNAL_SECRET) {
  console.warn('WARNING: INTERNAL_SECRET not set. Using default value (not recommended for production)');
}
const secret = INTERNAL_SECRET || 'clickcast-internal-dev-only';

// ========== Utility Functions ==========

/**
 * Check IP request rate limit
 * @param {string} ip - Client IP address
 * @param {number} [limit=5] - Maximum requests allowed in time window
 * @param {number} [windowMs=60000] - Time window in milliseconds, default 1 minute
 * @returns {boolean} Whether request is allowed (true = allowed, false = exceeded)
 */
function checkRateLimit(ip, limit = 5, windowMs = 60000) {
  const now = Date.now();
  const entry = rateLimiter.get(ip);

  // First request or time window has reset
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  // Increment count and check if exceeded
  entry.count++;
  return entry.count <= limit;
}

/**
 * Extract domain from URL
 * @param {string} url - Full URL string
 * @returns {string} Extracted domain (without www. prefix), or 'unknown-{timestamp}' on failure
 * @example
 * extractDomainFromUrl('https://www.example.com/path') // returns 'example.com'
 */
function extractDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    // Remove www. prefix to normalize domain format
    return urlObj.hostname.replace(/^www\./, '');
  } catch (e) {
    // Generate unique identifier when URL parsing fails
    return `unknown-${Date.now()}`;
  }
}

/**
 * Validate domain format
 * @param {string} domain - Domain to validate
 * @returns {string|null} Domain if valid, null otherwise
 * @description Prevents path traversal attacks, limits domain length to 253 characters
 */
function validateDomain(domain) {
  if (!domain || !/^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(domain) || domain.length > 253) {
    return null;
  }
  return domain;
}

/**
 * HTML escape function to prevent XSS attacks
 * @param {string} str - String to escape
 * @returns {string} Escaped safe string
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Load example videos configuration
 * @returns {Array<Object>} Example video list
 * @description Reads from data/examples.json for homepage display
 */
function loadExamples() {
  const examplesPath = path.join(__dirname, '../data/examples.json');
  if (fs.existsSync(examplesPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(examplesPath, 'utf-8'));
      return data.examples || [];
    } catch (e) {
      console.error('Failed to load examples.json:', e.message);
    }
  }
  return [];
}

/**
 * Generate example videos HTML snippet
 * @returns {string} HTML string for example video cards, empty string if no examples
 * @description Used for homepage YouTube embedded video examples
 */
function generateExamplesHtml() {
  const examples = loadExamples();
  if (examples.length === 0) return '';

  // Build example card HTML (using escapeHtml to prevent XSS)
  const cardsHtml = examples.map(ex => `
    <div class="example-card">
      <iframe src="https://www.youtube.com/embed/${escapeHtml(ex.youtubeId)}" allowfullscreen></iframe>
      <div class="example-info">
        <div class="example-title">${escapeHtml(ex.title)}</div>
        <div class="example-desc">${escapeHtml(ex.description)}</div>
      </div>
    </div>
  `).join('');

  return `
    <div class="examples">
      <h3>🎬 See it in action</h3>
      <div class="examples-grid">
        ${cardsHtml}
      </div>
    </div>
  `;
}

module.exports = {
  // State
  jobs,
  r2VideoUrls,
  rateLimiter,
  secret,

  // Utilities
  checkRateLimit,
  extractDomainFromUrl,
  validateDomain,
  escapeHtml,
  loadExamples,
  generateExamplesHtml
};
