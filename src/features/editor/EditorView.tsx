import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { navigate } from '../../app/router.ts'
import { History } from '../../engine/commands/History.ts'
import { NotebookDocument } from '../../engine/document/NotebookDocument.ts'
import { Editor } from '../../engine/editor/Editor.ts'
import { Button } from '../../design/index.ts'
import { useFixedViewport } from '../../lib/useFixedViewport.ts'
import { keyboardInset, onKeyboardInset } from '../../lib/keyboardInset.ts'
import { Autosave } from '../../storage/Autosave.ts'
import { setImageLoader } from '../../engine/render/images.ts'
import { getAssetBlob, loadNotebook, saveChanges } from '../../storage/notebooks.ts'
import { loadFeatures, saveFeatures } from './featureStore.ts'
import { Toolbar } from './Toolbar.tsx'
import { takeOpeningPage } from './openAt.ts'
import { NotesPanel } from '../presentation/NotesPanel.tsx'
import { SlidesPanel } from '../presentation/SlidesPanel.tsx'
import { Presenter } from '../presentation/Presenter.tsx'

type Loaded = { doc: NotebookDocument; history: History; autosave: Autosave }

export function EditorView({ id }: { id: string }) {
  const [loaded, setLoaded] = useState<Loaded | 'loading' | 'missing'>('loading')

  useEffect(() => {
    let cancelled = false
    let session: Loaded | null = null
    loadNotebook(id)
      .then((data) => {
        if (cancelled) return
        if (!data) {
          setLoaded('missing')
          return
        }
        const doc = new NotebookDocument(data.notebook, data.pages)
        session = { doc, history: new History(doc), autosave: new Autosave(doc, saveChanges) }
        setLoaded(session)
      })
      .catch((err: unknown) => {
        console.error(err)
        if (!cancelled) setLoaded('missing')
      })
    return () => {
      cancelled = true
      if (session) {
        const { autosave } = session
        void autosave.flush().finally(() => autosave.dispose())
      }
    }
  }, [id])

  if (loaded === 'loading') return <div className="h-full bg-desk" />
  if (loaded === 'missing') {
    return (
      <div className="grid h-full place-content-center justify-items-center gap-4 px-4 text-center">
        <p className="text-xl font-bold">This notebook was not found</p>
        <p className="text-ink-muted">It may have been deleted on this device.</p>
        <Button variant="primary" onClick={() => navigate({ name: 'library' })}>
          Back to notebooks
        </Button>
      </div>
    )
  }
  return <EditorSession {...loaded} />
}

function EditorSession({ doc, history, autosave }: Loaded) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  useFixedViewport()

  useEffect(() => {
    setImageLoader(getAssetBlob)
    const instance = new Editor(hostRef.current!, doc, history)
    const notebookId = doc.notebook.id
    instance.setRecentColors(loadRecentColors(notebookId))
    instance.setFeatures(loadFeatures())
    // Each notebook has its own recent colors, kept on this device; features apply to all.
    let saved = instance.state.recentColors
    let features = instance.state.features
    const stop = instance.subscribe(() => {
      if (instance.state.features !== features) {
        features = instance.state.features
        saveFeatures(features)
      }
      if (instance.state.recentColors === saved) return
      saved = instance.state.recentColors
      saveRecentColors(notebookId, saved)
    })
    setEditor(instance)
    const page = takeOpeningPage(notebookId)
    if (page > 0) instance.scrollToPage(page)
    // Text being typed stays above the app's own keyboard.
    const stopInset = onKeyboardInset(() => instance.setKeyboardInset(keyboardInset()))
    return () => {
      stopInset()
      stop()
      instance.dispose()
    }
  }, [doc, history])

  // Save right away when the app goes to the background; iPadOS may close it at any time.
  useEffect(() => {
    const flush = () => void autosave.flush()
    const onVisibility = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [autosave])

  const slides = doc.notebook.kind === 'presentation'
  const [presenting, setPresenting] = useState(false)
  const editorState = useSyncExternalStore(
    (fn) => editor?.subscribe(fn) ?? (() => {}),
    () => editor?.state ?? null,
  )

  const title = useSyncExternalStore(
    (fn) => doc.subscribe(fn),
    () => doc.notebook.title,
  )

  return (
    <div className="fixed inset-0 overflow-hidden bg-desk">
      {slides ? (
        // A presentation: the slides on the left, the slide with its notes beside them.
        <div className="absolute inset-0 flex">
          {editor ? <SlidesPanel editor={editor} state={editorState!} doc={doc} /> : null}
          <div className="flex min-w-0 flex-1 flex-col">
            <div ref={hostRef} className="relative min-h-0 flex-1" />
            {editor ? <NotesPanel editor={editor} state={editorState!} doc={doc} /> : null}
          </div>
        </div>
      ) : (
        <div ref={hostRef} className="absolute inset-0" />
      )}
      {editor ? (
        <Toolbar
          editor={editor}
          autosave={autosave}
          title={title}
          doc={doc}
          onBack={async () => {
            await autosave.flush()
            // Back to where the notebook lives: its folder, or the library.
            const folderId = doc.notebook.folderId
            navigate(folderId ? { name: 'folder', id: folderId } : { name: 'library' })
          }}
          onPresent={
            slides
              ? () => {
                  editor.finishEditing()
                  setPresenting(true)
                }
              : undefined
          }
        />
      ) : null}
      {presenting && editor ? (
        <Presenter
          doc={doc}
          start={editorState?.pageIndex ?? 0}
          onExit={(slide) => {
            setPresenting(false)
            editor.goToPage(slide)
          }}
        />
      ) : null}
    </div>
  )
}

const recentColorsKey = (notebookId: string) => `broomit.recentColors.${notebookId}`

function loadRecentColors(notebookId: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(recentColorsKey(notebookId)) ?? '[]')
    return Array.isArray(value) ? value.filter((c): c is string => typeof c === 'string') : []
  } catch {
    return []
  }
}

function saveRecentColors(notebookId: string, colors: string[]): void {
  try {
    localStorage.setItem(recentColorsKey(notebookId), JSON.stringify(colors))
  } catch {
    // Private browsing or full storage: recent colors are a convenience and may be lost.
  }
}
