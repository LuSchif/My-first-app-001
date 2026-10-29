import { useEffect, useState } from 'react'
import type { DocumentKind } from '../../engine/model/types.ts'
import { listFolders } from '../../storage/folders.ts'
import { listNotebooks } from '../../storage/notebooks.ts'

/**
 * The names already used by folders, or by notebooks of one kind, loaded once when a dialog
 * opens. `except` leaves out the item being renamed.
 */
export function useTakenNames(of: 'folder' | DocumentKind, except?: string): string[] {
  const [names, setNames] = useState<string[]>([])
  useEffect(() => {
    let alive = true
    const load =
      of === 'folder'
        ? listFolders().then((list) => list.filter((f) => f.id !== except).map((f) => f.name))
        : listNotebooks().then((list) =>
            list
              .filter((n) => (n.kind ?? 'notebook') === of && n.id !== except)
              .map((n) => n.title),
          )
    load.then((list) => alive && setNames(list)).catch((err: unknown) => console.error(err))
    return () => {
      alive = false
    }
  }, [of, except])
  return names
}
