import { MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { navigate } from '../../app/router.ts'
import { fillToCss, prefersLightText } from '../../engine/model/fill.ts'
import type { Notebook } from '../../engine/model/types.ts'
import { cn } from '../../lib/cn.ts'
import { formatEdited } from '../../lib/time.ts'
import {
  Button,
  Dialog,
  DialogTrigger,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../design/index.ts'
import { deleteNotebook, listNotebooks } from '../../storage/notebooks.ts'
import { BackupMenu, InstallHint } from './KeepSafe.tsx'
import { NewNotebookDialog } from './NewNotebookDialog.tsx'

/**
 * All notebooks, most recently edited first. The folder dashboard (work package 2) builds on
 * this view.
 */
export function LibraryView() {
  const [notebooks, setNotebooks] = useState<Notebook[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  const reload = useCallback(() => {
    listNotebooks()
      .then(setNotebooks)
      .catch((err: unknown) => {
        console.error(err)
        setLoadError(true)
      })
  }, [])

  useEffect(reload, [reload])

  const open = (id: string) => navigate({ name: 'notebook', id })

  return (
    <div className="min-h-full px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-16 sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Broomit</h1>
          <div className="flex flex-wrap gap-2">
            <BackupMenu onRestored={reload} />
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="primary" icon={<Plus size={18} />}>
                  New notebook
                </Button>
              </DialogTrigger>
              <NewNotebookDialog onCreated={open} />
            </Dialog>
          </div>
        </header>

        <InstallHint />

        {loadError ? (
          <p className="text-danger">
            Your notebooks could not be loaded. Reload the page; if it keeps happening, this browser
            may be blocking storage.
          </p>
        ) : notebooks === null ? null : notebooks.length === 0 ? (
          <EmptyState onCreated={open} />
        ) : (
          <section className="grid gap-4">
            <h2 className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
              Recent notebooks
            </h2>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-5 gap-y-7">
              {notebooks.map((notebook) => (
                <NotebookCard
                  key={notebook.id}
                  notebook={notebook}
                  onOpen={() => open(notebook.id)}
                  onDeleted={reload}
                />
              ))}
            </ul>
          </section>
        )}

        <footer className="flex gap-4 pt-6 text-sm text-ink-muted">
          <a href="./design.html" className="underline-offset-4 hover:underline">
            Design system
          </a>
          <a href="./ink-test.html" className="underline-offset-4 hover:underline">
            Ink test
          </a>
        </footer>
      </div>
    </div>
  )
}

function EmptyState({ onCreated }: { onCreated: (id: string) => void }) {
  return (
    <div className="grid justify-items-center gap-4 rounded-panel bg-surface-raised px-6 py-16 text-center shadow-soft">
      <p className="text-xl font-bold">No notebooks yet</p>
      <p className="max-w-[40ch] text-ink-muted">
        Create your first notebook, pick a paper, and start writing with your pencil.
      </p>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="primary" icon={<Plus size={18} />}>
            New notebook
          </Button>
        </DialogTrigger>
        <NewNotebookDialog onCreated={onCreated} />
      </Dialog>
    </div>
  )
}

function NotebookCard({
  notebook,
  onOpen,
  onDeleted,
}: {
  notebook: Notebook
  onOpen: () => void
  onDeleted: () => void
}) {
  const light = prefersLightText(notebook.cover)
  const pages = notebook.pageIds.length
  return (
    <li className="grid gap-2.5">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${notebook.title}`}
        className={cn(
          'flex aspect-[3/4] flex-col justify-end rounded-r-card rounded-l-md p-3.5 text-left shadow-raised',
          'transition-transform duration-200 ease-gentle hover:-translate-y-0.5 active:scale-[0.98]',
          light ? 'text-white' : 'text-ink',
        )}
        style={{ background: fillToCss(notebook.cover) }}
      >
        <span className="line-clamp-3 text-lg leading-tight font-bold break-words">
          {notebook.title}
        </span>
      </button>
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 text-sm">
          <p className="truncate font-semibold">{notebook.title}</p>
          <p className="text-ink-muted">
            {formatEdited(notebook.updatedAt)} · {pages} {pages === 1 ? 'page' : 'pages'}
          </p>
        </div>
        <DeleteMenu notebook={notebook} onDeleted={onDeleted} />
      </div>
    </li>
  )
}

function DeleteMenu({ notebook, onDeleted }: { notebook: Notebook; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton
          label={`More for ${notebook.title}`}
          icon={<MoreHorizontal size={20} />}
          className="-mt-2 -mr-2"
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-64 gap-3">
        <p className="text-sm">
          Delete <span className="font-semibold">{notebook.title}</span> and all its pages? This
          cannot be undone.
        </p>
        <Button
          variant="danger"
          icon={<Trash2 size={18} />}
          onClick={async () => {
            await deleteNotebook(notebook.id)
            setOpen(false)
            onDeleted()
          }}
        >
          Delete notebook
        </Button>
      </PopoverContent>
    </Popover>
  )
}
