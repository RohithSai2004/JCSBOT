import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: [
      'localhost',
      'e975-2409-40f0-30a9-cb0c-eceb-5260-78d9-371.ngrok-free.app',"vaguely-valid-roughy.ngrok-free.app",
      '*.ngrok-free.app'
    ],
    cors: true,
    hmr: {
      clientPort: 443
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
