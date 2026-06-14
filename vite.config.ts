import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 智行路线 Web 端构建配置
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    // POI 区域数据文件本身体积较大，上调阈值避免误报
    chunkSizeWarningLimit: 5000,
    // 稳定的浏览器目标，配合原生语法压缩
    target: 'es2020',
    rollupOptions: {
      output: {
        // 分离第三方依赖为独立 chunk：业务代码更新时不影响 vendor 长缓存
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router')) return 'vendor-router'
            if (id.includes('/react-dom/') || id.includes('node_modules/react/') || id.includes('scheduler/')) {
              return 'vendor-react'
            }
            if (id.includes('lucide-react')) return 'vendor-icons'
            if (id.includes('@amap')) return 'vendor-amap'
          }
        },
      },
    },
  },
})
