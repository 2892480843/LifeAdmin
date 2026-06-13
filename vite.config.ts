import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 智行路线 Web 端构建配置
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
})
