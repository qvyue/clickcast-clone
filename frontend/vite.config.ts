import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Inject preconnect for Supabase into index.html at build/dev time
function supabasePreconnect(): Plugin {
  return {
    name: 'supabase-preconnect',
    transformIndexHtml(html) {
      const url = process.env.VITE_SUPABASE_URL
      if (!url) return html
      const origin = new URL(url).origin
      return html.replace(
        '</head>',
        `  <link rel="preconnect" href="${origin}" />\n  <link rel="dns-prefetch" href="${origin}" />\n</head>`
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), supabasePreconnect()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/websites': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
})
