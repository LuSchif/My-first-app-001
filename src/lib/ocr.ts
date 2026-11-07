import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * Reading text in pictures of pages: handwriting, typed text and text in photos. In the iPad
 * app this is Apple's own recognizer (Vision, see ios/App/App/Ocr.swift), which reads
 * handwriting well and works offline. In a browser, Tesseract (German and English) is loaded
 * the first time it is needed, from the app's own files (dist/ocr).
 */

interface OcrPlugin {
  recognize(options: { image: string }): Promise<{ text: string }>
}

const NativeOcr = registerPlugin<OcrPlugin>('Ocr')

function nativeAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Ocr')
}

type WebWorker = Awaited<ReturnType<typeof import('tesseract.js').createWorker>>
let webWorker: Promise<WebWorker> | null = null

function tesseract(): Promise<WebWorker> {
  webWorker ??= import('tesseract.js').then(({ createWorker, OEM }) =>
    createWorker(
      ['deu', 'eng'],
      OEM.LSTM_ONLY,
      // The app's own copy (scripts/copy-ocr.mjs), so no CDN is needed and it works offline.
      {
        workerPath: new URL('ocr/worker.min.js', document.baseURI).href,
        corePath: new URL('ocr/', document.baseURI).href,
        langPath: new URL('ocr', document.baseURI).href,
      },
    ),
  )
  // A failed start (offline, say) may work next time.
  webWorker.catch(() => {
    webWorker = null
  })
  return webWorker
}

/** One recognition at a time: the recognizers are heavy, and pages queue up behind each other. */
let queue: Promise<unknown> = Promise.resolve()

/** The text in a picture, lines separated by line breaks; empty when there is none. */
export function recognizeText(canvas: HTMLCanvasElement): Promise<string> {
  const run = queue.then(() => recognize(canvas))
  queue = run.catch(() => undefined)
  return run
}

async function recognize(canvas: HTMLCanvasElement): Promise<string> {
  if (nativeAvailable()) {
    const image = canvas.toDataURL('image/jpeg', 0.9).split(',')[1] ?? ''
    const { text } = await NativeOcr.recognize({ image })
    return clean(text)
  }
  const worker = await tesseract()
  const { data } = await worker.recognize(canvas)
  return clean(data.text)
}

/** Trims every line and drops empty ones. */
function clean(text: string): string {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}
