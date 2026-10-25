import { useEffect, useState } from 'react'
import type { NotebookDocument } from '../../engine/document/NotebookDocument.ts'

/** A number that changes whenever the document does, to redraw what shows it. */
export function useDocVersion(doc: NotebookDocument): number {
  const [version, setVersion] = useState(0)
  useEffect(() => doc.subscribe(() => setVersion((v) => v + 1)), [doc])
  return version
}
