import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { Editor } from '../../engine/editor/Editor.ts'
import { isNativeApp } from '../../lib/install.ts'

/**
 * The Apple Pencil's double tap and squeeze, which only the App Store app receives (see
 * `ios/App/App/Pencil.swift`). They do what the person chose in Settings › Apple Pencil: switch
 * to the eraser (Broomit's broom) and back, back to the previous tool, or open the tool wheel,
 * where the pencil hovers.
 */

interface PencilEvent {
  action: 'eraser' | 'previous' | 'palette' | 'attributes' | 'ignore' | 'other'
  x?: number
  y?: number
}

interface PencilPlugin {
  addListener(
    event: 'tap' | 'squeeze',
    listener: (e: PencilEvent) => void,
  ): Promise<PluginListenerHandle>
}

const Pencil = registerPlugin<PencilPlugin>('Pencil')

function handle(editor: Editor, e: PencilEvent, squeeze: boolean): void {
  if (e.action === 'ignore') return
  if (e.action === 'eraser' || e.action === 'previous') {
    editor.pencilSwitch(e.action)
    return
  }
  // A squeeze, or a tap set to show a palette: the tool wheel, where the pencil is.
  if (squeeze || e.action === 'palette' || e.action === 'attributes') {
    if (editor.state.wheel) editor.closeWheel()
    else editor.openWheelAt(e.x, e.y)
  }
}

/** Listens to the pencil's gestures for `editor`; returns a function that stops listening. */
export function listenToPencil(editor: Editor): () => void {
  if (!isNativeApp()) return () => {}
  const handles: Promise<PluginListenerHandle>[] = [
    Pencil.addListener('tap', (e) => handle(editor, e, false)),
    Pencil.addListener('squeeze', (e) => handle(editor, e, true)),
  ]
  for (const h of handles) h.catch(() => {})
  return () => {
    for (const h of handles) void h.then((x) => x.remove()).catch(() => {})
  }
}
