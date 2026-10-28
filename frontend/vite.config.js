import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))

// معرّف النسخة: رقم الإيداع في GitHub Actions، أو وقت البناء محلياً.
// يُضمَّن في التطبيق ويُكتب في version.json، فيعرف كل جهاز أن نسخة أحدث نُشرت فيتحدّث.
const BUILD_ID = (process.env.GITHUB_SHA ?? '').slice(0, 12) || `local-${Date.now()}`

function swVersion() {
  let outDir = 'dist'
  return {
    name: 'sw-version',
    apply: 'build',
    configResolved: (c) => (outDir = c.build.outDir),
    closeBundle() {
      const sw = join(outDir, 'sw.js')
      if (!existsSync(sw)) return
      const text = readFileSync(sw, 'utf-8')
      if (!/const VERSION = '[^']*'/.test(text)) throw new Error('sw.js: لم أجد سطر VERSION')
      writeFileSync(sw, text.replace(/const VERSION = '([^']*)'/, `const VERSION = '$1-${BUILD_ID}'`))
    },
  }
}

/** سياسة أمان المحتوى: لا سكربت إلا من الموقع نفسه والسكربت الداخلي المعروف (بتجزئته)، ولا إضافات (object)، ولا نماذج خارجية. */
function cspMeta() {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`)
        const csp = [
          "default-src 'self'",
          `script-src 'self' ${inline.join(' ')}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "media-src 'self' https: blob: data:",
          "connect-src 'self' https:",
          "worker-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ')
        return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`)
      },
    },
  }
}

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

// قائمة ملفات الواجهة (js، css، خطوط، صور…) ليحفظها عامل الخدمة كلها عند أول زيارة،
// فتعمل الميزات المُحمَّلة عند الطلب (الدفتر، لوحة المعلّم، التحليل…) دون إنترنت حتى لو لم تُفتح من قبل.
function precacheList() {
  return {
    name: 'precache-list',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && !f.endsWith('.html'))
      this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(files) })
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
  plugins: [react(), tailwindcss(), precacheList(), spaFallback(), swVersion(), cspMeta(), versionFile()],
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
