/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createReadStream } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import OCR_FILES from './scripts/ocr-files.json' with { type: 'json' }

/** Serves text recognition's files under ocr/ while developing, as the build does (dist/ocr). */
const ocrFiles: Plugin = {
  name: 'ocr-files',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const name = req.url?.match(/\/ocr\/([^/?]+)/)?.[1]
      const file = name && OCR_FILES.find((f) => f.endsWith(`/${name}`))
      if (!file) return next()
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'application/gzip')
      createReadStream(file).pipe(res)
    })
  },
}

export default defineConfig({
  // Relative asset paths, so the build works under any path (e.g. GitHub Pages).
  base: './',
  plugins: [react(), tailwindcss(), ocrFiles],
  build: {
    rollupOptions: {
      input: { main: 'index.html', design: 'design.html' },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test-setup.ts'],
  },
})
