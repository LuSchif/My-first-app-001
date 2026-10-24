import { useEffect } from 'react'
import { TooltipProvider } from '../design/index.ts'
import { EditorView } from '../features/editor/EditorView.tsx'
import { LibraryView } from '../features/library/LibraryView.tsx'
import { requestPersistentStorage } from '../storage/db.ts'
import { usePencilTaps } from '../lib/usePencilTaps.ts'
import { useRequestedFocus } from '../lib/useRequestedFocus.ts'
import { useRoute } from './router.ts'

export function App() {
  const route = useRoute()
  usePencilTaps()
  useRequestedFocus()

  useEffect(() => {
    void requestPersistentStorage()
  }, [])

  return (
    <TooltipProvider>
      {route.name === 'notebook' ? <EditorView key={route.id} id={route.id} /> : <LibraryView />}
    </TooltipProvider>
  )
}
