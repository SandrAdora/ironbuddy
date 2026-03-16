import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],

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
      // File uploads go to the socket server
      '/upload': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Serve uploaded files through the same origin
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
