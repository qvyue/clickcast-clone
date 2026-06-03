/**
 * Pre-render Cache Layer
 * Manages filesystem cache for pre-rendered HTML snapshots.
 *
 * Docker: /data/prerender/ (persistent volume)
 * Local:  ./data/prerender/
 */

const fs = require('fs');
const path = require('path');

const CACHE_DIR = fs.existsSync('/data') ? '/data/prerender' : path.resolve(__dirname, '../../data/prerender');

const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Convert a URL path to a safe cache filename.
 *   '/'           → '_root.html'
 *   '/blog/my-post' → 'blog__my-post.html'
 */
function pathToFilename(urlPath) {
  const normalized = urlPath.endsWith('/') && urlPath.length > 1 ? urlPath.slice(0, -1) : urlPath;
  if (normalized === '/') return '_root.html';
  const safe = normalized
    .slice(1) // remove leading /
    .replace(/[^a-z0-9-]/gi, '_');
  return `${safe}.html`;
}

/**
 * Meta filename companion to a cache file.
 */
function metaFilename(htmlFile) {
  return htmlFile.replace(/\.html$/, '.meta.json');
}

/**
 * Ensure cache directory exists.
 */
function initCache() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`[prerender-cache] Cache dir: ${CACHE_DIR}`);
}

/**
 * Get cached HTML for a URL path.
 * Returns null if not cached or expired.
 */
function getCached(urlPath) {
  const filename = pathToFilename(urlPath);
  const filePath = path.join(CACHE_DIR, filename);
  const metaPath = path.join(CACHE_DIR, metaFilename(filename));

  if (!fs.existsSync(filePath)) return null;

  // Check TTL from meta file
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      if (meta.ttl && meta.createdAt && Date.now() - meta.createdAt > meta.ttl) {
        // Expired — delete both files
        fs.unlinkSync(filePath);
        try { fs.unlinkSync(metaPath); } catch (_) { /* ignore */ }
        return null;
      }
    } catch (_) {
      // Corrupt meta file — serve the HTML anyway
    }
  }

  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Save pre-rendered HTML to cache.
 * @param {string} urlPath
 * @param {string} html
 * @param {number} [ttl] - TTL in milliseconds. 0 or undefined = no expiry.
 */
function setCache(urlPath, html, ttl) {
  const filename = pathToFilename(urlPath);
  const filePath = path.join(CACHE_DIR, filename);

  fs.writeFileSync(filePath, html, 'utf-8');

  if (ttl) {
    const metaPath = path.join(CACHE_DIR, metaFilename(filename));
    fs.writeFileSync(metaPath, JSON.stringify({ createdAt: Date.now(), ttl }), 'utf-8');
  }
}

/**
 * Invalidate cache for a specific path, or flush all.
 * @param {string} [urlPath] - If omitted, flush entire cache.
 */
function invalidateCache(urlPath) {
  if (!urlPath) {
    // Flush all
    if (fs.existsSync(CACHE_DIR)) {
      for (const file of fs.readdirSync(CACHE_DIR)) {
        try { fs.unlinkSync(path.join(CACHE_DIR, file)); } catch (_) { /* ignore */ }
      }
    }
    console.log('[prerender-cache] Flushed all cache');
    return;
  }

  // Invalidate both old-style (no prefix) and new-style (page: prefix) cache keys
  for (const prefix of ['', 'page:']) {
    const filename = pathToFilename(prefix + urlPath);
    const filePath = path.join(CACHE_DIR, filename);
    const metaPath = path.join(CACHE_DIR, metaFilename(filename));

    try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
    try { fs.unlinkSync(metaPath); } catch (_) { /* ignore */ }
  }
}

/**
 * Return the active cache directory path.
 */
function getCacheDir() {
  return CACHE_DIR;
}

module.exports = { initCache, getCached, setCache, invalidateCache, getCacheDir, pathToFilename };
