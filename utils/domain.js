/**
 * Shared Domain Extraction Utility
 *
 * Provides extractDomainFromUrl(), duplicated in both server.js and pipeline.js.
 */

/**
 * Extract a clean hostname from a URL string.
 * Strips the "www." prefix and falls back to a timestamped placeholder
 * when parsing fails.
 *
 * @param {string} url  The full URL (e.g. "https://www.example.com/path").
 * @returns {string}    Clean domain (e.g. "example.com") or "unknown-<timestamp>".
 */
function extractDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch (e) {
    return `unknown-${Date.now()}`;
  }
}

module.exports = { extractDomainFromUrl };
