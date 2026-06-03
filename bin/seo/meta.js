/**
 * SEO Meta Configuration
 * Static page meta definitions and site-wide constants
 */

const SITE_URL = (process.env.APP_URL || 'https://vidgen.cc').replace(/\/+$/, '');
const SITE_NAME = 'VidGen';

const staticMeta = {
  '/': {
    title: 'VidGen — Website Video Generator from URL',
    description:
      'Turn any website URL into a professional marketing video. Auto-capture screenshots, AI-generated voiceover, subtitles, and music. 1080p/60fps, free tier available.',
    ogType: 'website',
    // jsonLd is built dynamically by buildHomepageJsonLd() in resolve.js
  },
  '/blog': {
    title: 'Blog — VidGen',
    description:
      'Guides, tutorials, and comparisons for website video creation.',
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

// WebApplication schema (used in buildHomepageJsonLd)
const webApplicationSchema = {
  '@type': 'WebApplication',
  name: 'VidGen',
  url: SITE_URL,
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Web',
  offers: [
    {
      '@type': 'Offer',
      name: 'Pro Subscription',
      description: 'Monthly subscription with 30 credits, 2-day free trial',
      price: '15',
      priceCurrency: 'USD',
      billingIncrement: 'P1M',
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'Credit Pack',
      description: 'One-time purchase of 3 credits, never expires',
      price: '3',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  ],
};

// HowTo schema for the 3-step workflow
const howToSchema = {
  '@type': 'HowTo',
  name: 'How to Create a Website Video with VidGen',
  description:
    'Transform any website into a professional marketing video in three simple steps.',
  step: [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'Paste your URL',
      text: 'Input any valid website address. Our system connects to your live site to capture assets.',
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: 'AI Analyzes & Plans',
      text: 'Our agent extracts text and visual hierarchy, then writes a structured script and plans scenes.',
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: 'Cinematic Video',
      text: 'Remotion orchestrates screenshots, voiceovers, and dynamic text into a ready-to-use marketing video.',
    },
  ],
};

module.exports = { SITE_URL, SITE_NAME, staticMeta, webApplicationSchema, howToSchema };
