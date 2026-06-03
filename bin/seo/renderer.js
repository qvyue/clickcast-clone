/**
 * Playwright Page Renderer
 * Renders a page using headless Chromium and returns the full HTML.
 *
 * Keeps a single browser instance alive for performance.
 * Uses a custom User-Agent to avoid recursive bot detection.
 */

let browser = null;

/**
 * Get or create the shared browser instance.
 */
async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    const { chromium } = require('playwright');
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
      ],
    });
    console.log('[prerender] Browser launched');
  }
  return browser;
}

/**
 * Render a page and return its full HTML.
 *
 * @param {string} internalUrl - Fully-qualified URL (e.g. http://localhost:3000/blog/my-post)
 * @returns {Promise<string|null>} Full HTML, or null on failure.
 */
async function renderPage(internalUrl) {
  const b = await getBrowser();

  // Use newContext with custom UA so the bot-detect middleware skips this request
  // (page.setUserAgent doesn't exist in Playwright headless-shell)
  const context = await b.newContext({ userAgent: 'VidGen-Prerender/1.0' });
  const page = await context.newPage();

  try {
    await page.goto(internalUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait for React to mount content inside #root
    await page.waitForSelector('#root > *', { timeout: 10000 });

    // Wait for async data to load:
    // - Blog posts: wait for article content to render (only appears after API response)
    // - Other pages: wait for network to go idle (all fetches complete)
    const url = new URL(internalUrl);
    if (url.pathname.match(/^\/blog\/[a-z0-9-]+$/)) {
      await page.waitForSelector('.blogpost-content', { timeout: 10000 });
    } else {
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    }

    return await page.content();
  } catch (err) {
    console.error('[prerender] Render failed for', internalUrl, ':', err.message);
    return null;
  } finally {
    await page.close();
    await context.close();
  }
}

/**
 * Close the shared browser instance. Call on process shutdown.
 */
async function closeBrowser() {
  if (browser) {
    try {
      await browser.close();
    } catch (_) { /* ignore */ }
    browser = null;
    console.log('[prerender] Browser closed');
  }
}

module.exports = { renderPage, closeBrowser };
