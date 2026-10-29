import { useEffect } from 'react'
import { TooltipProvider } from '../design/index.ts'
import { EditorView } from '../features/editor/EditorView.tsx'
import { FolderView } from '../features/folders/FolderView.tsx'
import { LibraryView } from '../features/library/LibraryView.tsx'
import { ShopView } from '../features/shop/ShopView.tsx'
import { requestPersistentStorage } from '../storage/db.ts'
import { usePencilTaps } from '../lib/usePencilTaps.ts'
import { useRequestedFocus } from '../lib/useRequestedFocus.ts'
import { useVirtualKeyboard } from '../features/keyboard/useVirtualKeyboard.ts'
import { VirtualKeyboard } from '../features/keyboard/VirtualKeyboard.tsx'
import { useRoute } from './router.ts'
import { UpdateBanner } from './UpdateBanner.tsx'
import { ReminderToasts } from '../features/calendar/ReminderToasts.tsx'
import { Notices } from './Notices.tsx'
import { TrashZone } from '../features/library/TrashZone.tsx'

export function App() {
  const route = useRoute()
  usePencilTaps()
  // On iPad, Broomit's own keyboard takes over text fields; elsewhere fields only take focus
  // when tapped.
  const ownKeyboard = useVirtualKeyboard()
  useRequestedFocus(!ownKeyboard)

  useEffect(() => {
    void requestPersistentStorage()
  }, [])

  return (
    <TooltipProvider>
      {route.name === 'notebook' ? (
        <EditorView key={route.id} id={route.id} />
      ) : route.name === 'folder' ? (
        <FolderView key={route.id} id={route.id} />
      ) : route.name === 'shop' ? (
        <ShopView />
      ) : (
        <LibraryView />
      )}
      {ownKeyboard ? <VirtualKeyboard /> : null}
      <UpdateBanner />
      <ReminderToasts />
      <Notices />
      <TrashZone />
    </TooltipProvider>
  )
}
