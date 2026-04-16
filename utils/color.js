/**
 * Shared Color Utilities
 *
 * Provides color manipulation and validation functions used across
 * capture.js and style-generator.js for video color processing.
 */

// ---------------------------------------------------------------------------
// Core conversions
// ---------------------------------------------------------------------------

/**
 * Convert RGB (0-255) to HSL (h: 0-360, s: 0-100, l: 0-100).
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {number[]} [h, s, l]
 */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

/**
 * Convert HSL to a hex color string (uppercase).
 *
 * @param {number} h  Hue (0-360)
 * @param {number} s  Saturation (0-100)
 * @param {number} l  Lightness (0-100)
 * @returns {string}  e.g. "#9B4DFF"
 */
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Perceptual measurements
// ---------------------------------------------------------------------------

/**
 * Compute perceived brightness (luminance) of a hex color.
 * Uses the WCAG luminance weights: 0.299R + 0.587G + 0.114B.
 *
 * @param {string} hex  e.g. "#1E2327"
 * @returns {number} 0-255
 */
function getLuminance(hex) {
  if (!hex || !hex.startsWith('#')) return 128;
  const num = parseInt(hex.slice(1), 16);
  const r = num >> 16;
  const g = (num >> 8) & 0xFF;
  const b = num & 0xFF;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Compute the HSL saturation of a hex color.
 *
 * @param {string} hex  e.g. "#2DA44E"
 * @returns {number} 0-1
 */
function getSaturation(hex) {
  if (!hex || !hex.startsWith('#')) return 0.5;
  const num = parseInt(hex.slice(1), 16);
  const r = num >> 16;
  const g = (num >> 8) & 0xFF;
  const b = num & 0xFF;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return 0; // achromatic

  const d = max - min;
  return l > 127.5 ? d / (510 - max - min) : d / (max + min);
}

// ---------------------------------------------------------------------------
// Adjustments
// ---------------------------------------------------------------------------

/**
 * Shift every RGB channel of a hex color by a fixed amount.
 *
 * @param {string} hex       e.g. "#9B4DFF"
 * @param {number} percent   Positive = brighter, negative = darker.
 * @returns {string} Adjusted hex (uppercase).
 */
function adjustBrightness(hex, percent) {
  if (!hex || !hex.startsWith('#')) return hex;

  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));

  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`.toUpperCase();
}

/**
 * Ensure a color is suitable for display on a dark video background.
 * Adjusts lightness into [30%, 70%] and saturation to at least 40%.
 *
 * @param {string} hex               Input hex color.
 * @param {object} [options]
 * @param {string} [options.fallback] Returned when input is invalid.
 * @returns {string} Adjusted hex color.
 */
function ensureVideoSuitableColor(hex, options = {}) {
  if (!hex || !hex.startsWith('#')) return options.fallback || '#9B4dff';

  const luminance = getLuminance(hex);
  const saturation = getSaturation(hex);

  const num = parseInt(hex.slice(1), 16);
  let r = num >> 16;
  let g = (num >> 8) & 0xFF;
  let b = num & 0xFF;

  let [h, s, l] = rgbToHsl(r, g, b);

  const MIN_LIGHTNESS = 30;
  const MAX_LIGHTNESS = 70;
  const MIN_SATURATION = 40;

  let adjusted = false;

  // Adjust lightness
  if (l < MIN_LIGHTNESS) {
    l = MIN_LIGHTNESS + (l / MIN_LIGHTNESS) * 10;
    adjusted = true;
  } else if (l > MAX_LIGHTNESS) {
    l = MAX_LIGHTNESS - ((100 - l) / (100 - MAX_LIGHTNESS)) * 10;
    adjusted = true;
  }

  // Adjust saturation
  if (s < MIN_SATURATION && s > 0) {
    s = MIN_SATURATION + (s / MIN_SATURATION) * 20;
    adjusted = true;
  } else if (s === 0 && l > 20 && l < 80) {
    // Pure gray -- give it a purple tint
    s = 50;
    h = l > 50 ? 250 : 280;
    adjusted = true;
  }

  if (adjusted) {
    const newHex = hslToHex(h, s, l);
    console.log(`   Color adjusted: ${hex} -> ${newHex} (luminance ${luminance.toFixed(0)}->${l.toFixed(0)}%, saturation ${(saturation * 100).toFixed(0)}->${s.toFixed(0)}%)`);
    return newHex;
  }

  return hex;
}

// ---------------------------------------------------------------------------
// Validation / selection
// ---------------------------------------------------------------------------

/**
 * Validate that a color string is a standard hex or rgb/rgba format.
 * Rejects modern CSS color formats (oklch, oklab, lch, lab).
 *
 * @param {string} color
 * @returns {boolean}
 */
function isValidVideoColor(color) {
  if (!color || typeof color !== 'string') return false;
  return /^#[0-9A-Fa-f]{3,8}$/.test(color) ||
         /^rgba?\(/.test(color);
}

/**
 * Pick the first valid video color from a list (or single value).
 *
 * @param {string|string[]} colors
 * @param {string}          fallback
 * @returns {string}
 */
function pickValidColor(colors, fallback) {
  if (Array.isArray(colors)) {
    for (const c of colors) {
      if (c && isValidVideoColor(c)) {
        return c;
      }
    }
  }
  if (isValidVideoColor(colors)) {
    return colors;
  }
  return fallback;
}

module.exports = {
  getLuminance,
  getSaturation,
  adjustBrightness,
  rgbToHsl,
  hslToHex,
  ensureVideoSuitableColor,
  isValidVideoColor,
  pickValidColor,
};
