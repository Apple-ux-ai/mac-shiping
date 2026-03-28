import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api-web': {
        target: 'https://api-web.kunqiongai.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api-web/, ''),
      },
    },
  },
})
