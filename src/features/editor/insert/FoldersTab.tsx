import {
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  FileImage,
  FilePlus2,
  Folder as FolderIcon,
  ScanSearch,
} from 'lucide-react'
import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from '../../../design/index.ts'
import type { NotebookDocument } from '../../../engine/document/NotebookDocument.ts'
import type { Editor } from '../../../engine/editor/Editor.ts'
import type { Folder, Id, Notebook, Page } from '../../../engine/model/types.ts'
import { drawPage, preloadPictures } from '../../../engine/render/pageImage.ts'
import { pageSizeOf } from '../../../engine/render/layout.ts'
import { showNotice } from '../../../lib/notices.ts'
import { loadNotebook } from '../../../storage/notebooks.ts'
import { useLibrary } from '../../library/useLibrary.ts'
import { insertImageBlob, type Drop } from '../images.ts'
import { PageThumbnail } from '../PageThumbnail.tsx'
import { bringPage } from './copyAssets.ts'
import { ExtractView } from './ExtractView.tsx'
import type { useDragToPage } from './useDragToPage.ts'

type Source = ReturnType<typeof useDragToPage>['source']

/** A notebook opened in the panel: its pages, ready to drag. */
interface Opened {
  notebook: Notebook
  pages: Page[]
}

/**
 * Your Broomit folders and notebooks. Open a notebook to drag its pages onto your page (as a new
 * page or as a picture), or take a single element out of it with the magnifier.
 */
export function FoldersTab({
  editor,
  doc,
  source,
}: {
  editor: Editor
  doc: NotebookDocument
  source: Source
}) {
  const { library } = useLibrary()
  const [folderId, setFolderId] = useState<Id | null>(null)
  const [opened, setOpened] = useState<Opened | null>(null)
  const [asking, setAsking] = useState<{ page: Page; from: Opened; drop?: Drop } | null>(null)
  const [extracting, setExtracting] = useState<Opened | null>(null)

  const open = (notebook: Notebook, then: (o: Opened) => void) =>
    loadNotebook(notebook.id)
      .then((data) => data && then({ notebook: data.notebook, pages: data.pages }))
      .catch((err: unknown) => {
        console.error(err)
        showNotice('This notebook could not be opened.')
      })

  if (!library) return <p className="text-sm text-ink-muted">Loading your folders…</p>

  const folder = library.folders.find((f) => f.id === folderId) ?? null
  const folders = library.folders
    .filter((f) => f.parentId === folderId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  // Quizzes have no pages to take from.
  const notebooks = library.notebooks
    .filter((n) => n.folderId === folderId && n.kind !== 'quiz')
    .sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="grid gap-3">
      {opened ? (
        <NotebookPages
          opened={opened}
          source={source}
          onBack={() => setOpened(null)}
          onPick={(page, drop) => setAsking({ page, from: opened, ...(drop ? { drop } : {}) })}
          onExtract={() => setExtracting(opened)}
        />
      ) : (
        <>
          {folder ? (
            <button
              type="button"
              onClick={() => setFolderId(folder.parentId)}
              className="flex items-center gap-1 justify-self-start rounded-control py-1 pr-2 text-sm font-semibold text-ink-muted hover:bg-hover"
            >
              <ChevronLeft size={18} /> {parentName(library.folders, folder.parentId)}
            </button>
          ) : null}
          {folder ? <h3 className="text-base font-bold">{folder.name}</h3> : null}
          <ul className="grid gap-1">
            {folders.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setFolderId(f.id)}
                  className="flex w-full items-center gap-3 rounded-control p-2 text-left hover:bg-hover"
                >
                  <FolderIcon size={20} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{f.name}</span>
                  <ChevronRight size={18} className="text-ink-subtle" />
                </button>
              </li>
            ))}
            {notebooks.map((n) => (
              <li key={n.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void open(n, setOpened)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-control p-2 text-left hover:bg-hover"
                >
                  <span
                    className="h-8 w-6 shrink-0 rounded-[0.3rem] shadow-soft"
                    style={{
                      background: n.cover.type === 'solid' ? n.cover.color : 'var(--color-accent)',
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {n.title}
                      {n.id === doc.notebook.id ? (
                        <span className="font-normal text-ink-muted"> (this one)</span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-ink-muted">
                      {n.pageIds.length} {n.pageIds.length === 1 ? 'page' : 'pages'}
                    </span>
                  </span>
                </button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={`More for ${n.title}`}
                      className="grid size-10 shrink-0 place-items-center rounded-control text-ink-muted hover:bg-hover"
                    >
                      <Ellipsis size={18} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="grid w-64 gap-0.5 p-1.5">
                    <PopoverClose asChild>
                      <button
                        type="button"
                        onClick={() => void open(n, setExtracting)}
                        className="flex min-h-11 items-center gap-2.5 rounded-control px-3 text-left text-sm font-semibold hover:bg-hover"
                      >
                        <ScanSearch size={18} />
                        <span>
                          Take out an element
                          <span className="block text-xs font-normal text-ink-muted">
                            Point at it with the magnifier
                          </span>
                        </span>
                      </button>
                    </PopoverClose>
                  </PopoverContent>
                </Popover>
              </li>
            ))}
          </ul>
          {folders.length === 0 && notebooks.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing in this folder yet.</p>
          ) : null}
        </>
      )}

      <Dialog open={asking !== null} onOpenChange={(o) => !o && setAsking(null)}>
        {asking ? (
          <AddPageDialog editor={editor} doc={doc} asking={asking} onDone={() => setAsking(null)} />
        ) : null}
      </Dialog>
      {extracting ? (
        <ExtractView
          editor={editor}
          doc={doc}
          notebook={extracting.notebook}
          pages={extracting.pages}
          onClose={() => setExtracting(null)}
        />
      ) : null}
    </div>
  )
}

function parentName(folders: readonly Folder[], id: Id | null): string {
  return folders.find((f) => f.id === id)?.name ?? 'All folders'
}

const THUMB = 132

function NotebookPages({
  opened,
  source,
  onBack,
  onPick,
  onExtract,
}: {
  opened: Opened
  source: Source
  onBack: () => void
  onPick: (page: Page, drop?: Drop) => void
  onExtract: () => void
}) {
  const { notebook, pages } = opened
  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 justify-self-start rounded-control py-1 pr-2 text-sm font-semibold text-ink-muted hover:bg-hover"
      >
        <ChevronLeft size={18} /> Back
      </button>
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-base font-bold">{notebook.title}</h3>
        <Button icon={<ScanSearch size={18} />} onClick={onExtract}>
          Take out
        </Button>
      </div>
      <ul className="grid grid-cols-2 gap-3">
        {pages.map((page, i) => (
          <li key={page.id}>
            <button
              type="button"
              aria-label={`Page ${i + 1}`}
              className="grid w-full gap-1 text-xs font-semibold text-ink-muted select-none"
              {...source(
                `Page ${i + 1}`,
                () => onPick(page),
                (clientX, clientY) => onPick(page, { clientX, clientY }),
              )}
            >
              <span className="pointer-events-none overflow-hidden rounded-md shadow-raised ring-1 ring-line">
                <PageThumbnail
                  width={THUMB}
                  page={page}
                  layers={notebook.layers}
                  background={notebook.background}
                  size={pageSizeOf(notebook)}
                />
              </span>
              {i + 1}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A page dropped (or tapped): add it as a page of this notebook, or as a picture. */
function AddPageDialog({
  editor,
  doc,
  asking,
  onDone,
}: {
  editor: Editor
  doc: NotebookDocument
  asking: { page: Page; from: Opened; drop?: Drop }
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const run = (work: () => Promise<void>) => {
    setBusy(true)
    work()
      .then(onDone)
      .catch((err: unknown) => {
        console.error(err)
        showNotice('The page could not be added.')
      })
      .finally(() => setBusy(false))
  }
  return (
    <DialogContent
      title="Add this page"
      description={`From “${asking.from.notebook.title}”. As a page of its own, everything on it stays editable; as a picture, it goes onto your page.`}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const page = await bringPage(asking.page, doc.notebook.id)
              editor.addPageCopy(page)
            })
          }
          className="grid gap-1 rounded-card p-4 text-left ring-1 ring-line hover:bg-hover disabled:opacity-50"
        >
          <FilePlus2 size={22} className="text-accent" />
          <span className="font-semibold">As a new page</span>
          <span className="text-sm text-ink-muted">Added after the page you are on.</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const blob = await pagePicture(asking.page, asking.from.notebook)
              await insertImageBlob(editor, doc.notebook.id, blob, asking.drop, 0.6)
            })
          }
          className="grid gap-1 rounded-card p-4 text-left ring-1 ring-line hover:bg-hover disabled:opacity-50"
        >
          <FileImage size={22} className="text-accent" />
          <span className="font-semibold">As a picture</span>
          <span className="text-sm text-ink-muted">
            {asking.drop ? 'Placed where you dropped it.' : 'Placed in the middle of the view.'}
          </span>
        </button>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

/** A sharp picture of a page (twice its size in points). */
async function pagePicture(page: Page, notebook: Notebook): Promise<Blob> {
  await preloadPictures([page])
  const size = pageSizeOf(notebook)
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(size.width * scale)
  canvas.height = Math.round(size.height * scale)
  drawPage(canvas.getContext('2d')!, page, notebook.layers, scale, notebook.background, size)
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/png'),
  )
}
