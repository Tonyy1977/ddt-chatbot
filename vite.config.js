import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': 'http://localhost:4000', // forward API calls to backend
    },
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'micah.docsapp.org', // 👈 Cloudflare Tunnel hostname
    ],
  },
})
