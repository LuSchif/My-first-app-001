/**
 * A minimal PDF writer: one page per JPEG image, each filling the page. Enough for exporting
 * notebook pages without a PDF library.
 */
export interface PdfImagePage {
  jpeg: Uint8Array
  /** Pixel size of the image. */
  width: number
  height: number
}

/** Page size in points (1/72 inch). */
export function makePdf(pages: PdfImagePage[], pageWidth: number, pageHeight: number): Blob {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part
    chunks.push(bytes)
    length += bytes.length
  }
  const object = (id: number, body: () => void) => {
    offsets[id] = length
    push(`${id} 0 obj\n`)
    body()
    push('\nendobj\n')
  }

  // Objects: 1 catalog, 2 page tree, then per page: page, content, image.
  const pageId = (i: number) => 3 + i * 3
  push('%PDF-1.4\n%âãÏÓ\n')
  object(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'))
  object(2, () =>
    push(
      `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] >>`,
    ),
  )
  pages.forEach((page, i) => {
    const id = pageId(i)
    object(id, () =>
      push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
          `/Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`,
      ),
    )
    const content = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im0 Do Q`
    object(id + 1, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`))
    object(id + 2, () => {
      push(
        `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      )
      push(page.jpeg)
      push('\nendstream')
    })
  })

  const count = 3 + pages.length * 3
  const xref = length
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`
  for (let id = 1; id < count; id++) table += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  push(table)
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' })
}
