/**
 * SEO Meta Configuration
 * Static page meta definitions and site-wide constants
 */

const SITE_URL = process.env.SITE_URL || 'https://vidgen.site';
const SITE_NAME = 'VidGen';

const staticMeta = {
  '/': {
    title: 'VidGen — AI Product Demo Video Generator from URL',
    description:
      'Turn any website URL into a polished product demo video. Auto-capture screenshots, AI-generated voiceover, subtitles, and music. 1080p/60fps, free tier available.',
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'VidGen',
      url: SITE_URL,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free tier with 1080p/60fps output',
      },
    },
  },
  '/blog': {
    title: 'Blog — VidGen',
    description:
      'Guides, tutorials, and comparisons for AI product demo video creation.',
    ogType: 'website',
  },
  '/terms': {
    title: 'Terms of Service — VidGen',
    description: 'VidGen terms of service and usage agreement.',
    ogType: 'website',
  },
  '/privacy': {
    title: 'Privacy Policy — VidGen',
    description: 'VidGen privacy policy and data handling practices.',
    ogType: 'website',
  },
};

module.exports = { SITE_URL, SITE_NAME, staticMeta };
