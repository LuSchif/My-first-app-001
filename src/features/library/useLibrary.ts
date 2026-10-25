import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Folder, Notebook } from '../../engine/model/types.ts'
import { listFolders, withDescendants } from '../../storage/folders.ts'
import { listNotebooks } from '../../storage/notebooks.ts'
import { useTrashed } from './trash.ts'

export interface Library {
  folders: Folder[]
  notebooks: Notebook[]
}

/**
 * All folders and notebooks, loaded from storage; `reload` after changing them. What was just
 * dropped on the trash is left out (with everything in a trashed folder).
 */
export function useLibrary(): { library: Library | null; error: boolean; reload: () => void } {
  const [library, setLibrary] = useState<Library | null>(null)
  const [error, setError] = useState(false)
  const reload = useCallback(() => {
    Promise.all([listFolders(), listNotebooks()])
      .then(([folders, notebooks]) => setLibrary({ folders, notebooks }))
      .catch((err: unknown) => {
        console.error(err)
        setError(true)
      })
  }, [])
  useEffect(reload, [reload])
  const trashed = useTrashed()
  const shown = useMemo(() => {
    if (!library || trashed.size === 0) return library
    const gone = new Set<string>()
    for (const f of library.folders) {
      if (trashed.has(f.id)) for (const id of withDescendants(library.folders, f.id)) gone.add(id)
    }
    return {
      folders: library.folders.filter((f) => !gone.has(f.id)),
      notebooks: library.notebooks.filter(
        (n) => !trashed.has(n.id) && !(n.folderId && gone.has(n.folderId)),
      ),
    }
  }, [library, trashed])
  return { library: shown, error, reload }
}
