/**
 * HTML Meta Injection
 * Injects <title>, <meta>, <link>, and JSON-LD into the SPA shell HTML
 */

/**
 * Escape a string for safe embedding in HTML text content.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape a string for safe use inside an HTML attribute value (double-quoted).
 */
function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Inject SEO meta tags into the index.html shell.
 *
 * @param {string} html - Raw index.html content
 * @param {object} meta - Meta object with: title, description, ogType, ogImage?, canonical?, jsonLd?
 * @returns {string} HTML with injected meta
 */
function injectMeta(html, meta) {
  let result = html;

  // 1. Replace <title>
  result = result.replace(
    /<title>.*?<\/title>/,
    `<title>${escapeHtml(meta.title)}</title>`,
  );

  // 2. Build meta tags to inject before </head>
  const tags = [];

  tags.push(
    `<meta name="description" content="${escapeAttr(meta.description)}">`,
  );
  tags.push(
    `<meta property="og:title" content="${escapeAttr(meta.title)}">`,
  );
  tags.push(
    `<meta property="og:description" content="${escapeAttr(meta.description)}">`,
  );
  tags.push(
    `<meta property="og:type" content="${escapeAttr(meta.ogType || 'website')}">`,
  );
  tags.push(
    `<meta property="og:site_name" content="VidGen">`,
  );

  if (meta.ogImage) {
    tags.push(
      `<meta property="og:image" content="${escapeAttr(meta.ogImage)}">`,
    );
  }

  tags.push(`<meta name="twitter:card" content="summary_large_image">`);
  tags.push(
    `<meta name="twitter:title" content="${escapeAttr(meta.title)}">`,
  );
  tags.push(
    `<meta name="twitter:description" content="${escapeAttr(meta.description)}">`,
  );

  if (meta.ogImage) {
    tags.push(
      `<meta name="twitter:image" content="${escapeAttr(meta.ogImage)}">`,
    );
  }

  if (meta.canonical) {
    tags.push(
      `<link rel="canonical" href="${escapeAttr(meta.canonical)}">`,
    );
  }

  if (meta.jsonLd) {
    tags.push(
      `<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`,
    );
  }

  // 3. Inject before </head>
  result = result.replace('</head>', tags.join('\n') + '\n</head>');

  return result;
}

module.exports = { injectMeta };
