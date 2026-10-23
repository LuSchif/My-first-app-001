/** Hands a file to the user: the browser's download, or the share sheet on iPad. */
export function saveFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Several files at once. The share sheet takes them together (e.g. "Save Images" on iPad);
 * without it they are downloaded one by one.
 */
export async function saveFiles(files: File[]): Promise<void> {
  if (files.length > 1 && navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files })
      return
    } catch (err) {
      // Closing the share sheet is not an error worth falling back for.
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }
  for (const file of files) saveFile(file, file.name)
}

/** A name safe to use for a file on any system. */
export function fileName(title: string): string {
  return title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Broomit'
}
