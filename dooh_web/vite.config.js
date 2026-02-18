import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from "vite-plugin-mkcert"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), mkcert()],
  server: {
    port: 8000,
    open: true,
    https: false,
    proxy: {
      "/api/detect": {
        target: process.env.DETECT_API_BACKEND,
        changeOrigin: true,
      },
    },
  },
})
