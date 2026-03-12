import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:443',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: '../backend/dist',
    emptyOutDir: true,
  }
})
