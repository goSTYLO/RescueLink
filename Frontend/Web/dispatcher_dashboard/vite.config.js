import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  envDir: __dirname,
  plugins: [react()],
  server: {
    port: 5173
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/data': path.resolve(__dirname, './src/data'),
      '@/domain': path.resolve(__dirname, './src/domain'),
      '@/presentation': path.resolve(__dirname, './src/presentation'),
      '@/infrastructure': path.resolve(__dirname, './src/infrastructure'),
    },
  },
})
