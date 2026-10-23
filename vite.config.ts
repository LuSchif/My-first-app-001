/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset paths, so the build works under any path (e.g. GitHub Pages).
  base: './',
  plugins: [react(), tailwindcss()],
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
