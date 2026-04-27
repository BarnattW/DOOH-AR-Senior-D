import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from "vite-plugin-mkcert"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), mkcert()],
  optimizeDeps: {
    include: ["onnxruntime-web"],
  },
  server: {
    port: 8000,
    open: true,
    https: false,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    proxy: {
      "/api/detect": {
        target: process.env.DETECT_API_BACKEND,
        changeOrigin: true,
      },
    },
  },
})
