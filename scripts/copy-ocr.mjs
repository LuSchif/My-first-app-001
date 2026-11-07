// Copies what text recognition needs in a browser (Tesseract: its worker, its WebAssembly core
// and the German and English language data, listed in ocr-files.json) into dist/ocr, so it
// works without a CDN and offline. The app loads these files only when text is first read
// (src/lib/ocr.ts); the dev server serves the same files (vite.config.ts).
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const files = JSON.parse(readFileSync('scripts/ocr-files.json', 'utf8'))
const out = join('dist', 'ocr')
mkdirSync(out, { recursive: true })
for (const file of files) copyFileSync(file, join(out, file.split('/').pop()))
