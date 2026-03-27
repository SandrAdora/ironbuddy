import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function parseEnvFile(filePath: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(filePath, 'utf-8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.startsWith('#'))
        .map((l) => {
          const idx = l.indexOf('=');
          return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
        })
    );
  } catch { return {}; }
}

const frontendEnv = parseEnvFile(resolve(__dirname, '../.env/frontend.env'));

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_I18NEXUS_API_KEY': JSON.stringify(
      process.env.VITE_I18NEXUS_API_KEY ?? frontendEnv.VITE_I18NEXUS_API_KEY ?? ''
    ),
  },
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'IronBuddy',
        short_name: 'IronBuddy',
        description: 'AI-powered fitness and nutrition coach',
        theme_color: '#facc15',
        background_color: '#0d0d10',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache static assets (JS, CSS, fonts, images)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Don't cache API calls — always fetch fresh
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/, /^\/media/, /^\/uploads/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],

  server: {
    host: true,   // expose to local network so phones can connect
    port: 5173,

    // Proxy all backend traffic through Vite so mobile only needs one address.
    // Without this, api.ts would use hardcoded "localhost:8001" which resolves
    // to the phone itself, not the dev machine.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Serve uploaded media files from Django
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Serve files uploaded via the socket server (old profile pictures)
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Socket.io — ws:true proxies WebSocket upgrade as well as HTTP polling
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
