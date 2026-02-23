import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // fail fast if 5173 is taken (prevents OAuth redirect_uri_mismatch)
    proxy: {
      '/api/pandadoc': {
        target: 'https://api.pandadoc.com/public/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pandadoc/, ''),
        secure: true,
      }
    }
  }
})
