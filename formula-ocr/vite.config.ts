import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 代码分割优化
    rollupOptions: {
      output: {
        manualChunks: {
          // 将 React 相关库单独打包
          'vendor-react': ['react', 'react-dom'],
          // 将 PDF.js 单独打包（按需加载）
          'vendor-pdf': ['pdfjs-dist'],
        },
      },
    },
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 压缩选项 - 使用默认 esbuild
    // chunk 大小警告阈值
    chunkSizeWarningLimit: 500,
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['pdfjs-dist'], // PDF.js 按需加载
  },
})
