import { useCallback, useEffect, useState } from 'react'
import type { Folder, Notebook } from '../../engine/model/types.ts'
import { listFolders } from '../../storage/folders.ts'
import { listNotebooks } from '../../storage/notebooks.ts'

export interface Library {
  folders: Folder[]
  notebooks: Notebook[]
}

/** All folders and notebooks, loaded from storage; `reload` after changing them. */
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
  return { library, error, reload }
}
