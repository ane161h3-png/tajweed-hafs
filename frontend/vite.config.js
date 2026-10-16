import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))

// معرّف النسخة: رقم الإيداع في GitHub Actions، أو وقت البناء محلياً.
// يُضمَّن في التطبيق ويُكتب في version.json، فيعرف كل جهاز أن نسخة أحدث نُشرت فيتحدّث.
const BUILD_ID = (process.env.GITHUB_SHA ?? '').slice(0, 12) || `local-${Date.now()}`

function versionFile() {
  let outDir = 'dist'
  return {
    name: 'version-file',
    apply: 'build',
    configResolved: (c) => (outDir = c.build.outDir),
    closeBundle() {
      writeFileSync(join(outDir, 'version.json'), JSON.stringify({ build: BUILD_ID, at: new Date().toISOString() }))
    },
  }
}

// الاستضافة الثابتة (GitHub Pages وغيرها): صفحة 404 هي التطبيق نفسه، فتعمل الروابط العميقة
function spaFallback() {
  let outDir = 'dist'
  return {
    name: 'spa-404',
    apply: 'build',
    configResolved: (c) => (outDir = c.build.outDir),
    closeBundle() {
      const index = join(outDir, 'index.html')
      if (existsSync(index)) copyFileSync(index, join(outDir, '404.html'))
    },
  }
}

export default defineConfig({
  // مسار الاستضافة: '/' للنطاق الرئيسي، أو '/اسم-المستودع/' في GitHub Pages
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss(), spaFallback(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8000' },
    fs: { allow: ['..'] },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    root: here('..'),
    include: ['tests/frontend/**/*.test.{js,jsx}'],
    setupFiles: [here('../tests/frontend/setup.js')],
    // ملفات الاختبار في tests/frontend خارج هذا المجلد، فنوجّه الحزم إلى node_modules هنا
    alias: [
      {
        find: /^(react|react-dom|react-router|framer-motion|@testing-library\/[^/]+)(\/.*)?$/,
        replacement: here('./node_modules/') + '$1$2',
      },
    ],
  },
})
