/**
 * Bot User-Agent Detection
 * Identifies search engine crawlers, social platform bots, and AI crawlers.
 */

const BOT_PATTERN =
  /googlebot|google-inspectiontool|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebot|ia_archiver|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|skypeuripreview|ahrefsbot|mj12bot|semrushbot|dotbot|applebot|bytespider|petalbot|pinterestbot|gptbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|cohere-ai|ai2bot|amazonbot|applebot-extended|ccbot|diffbot|omgili|newsme|turnitinbot/i;

/**
 * Check if a User-Agent string belongs to a known bot/crawler.
 * @param {string} userAgent
 * @returns {boolean}
 */
function isBot(userAgent) {
  if (!userAgent) return false;
  return BOT_PATTERN.test(userAgent);
}

module.exports = { isBot };
