import { Paintbrush } from 'lucide-react'
import { useState } from 'react'
import { createNotebook } from '../../engine/model/factory.ts'
import { fillToCss, type Fill } from '../../engine/model/fill.ts'
import type { Folder, Id, PaperKind } from '../../engine/model/types.ts'
import { cn } from '../../lib/cn.ts'
import {
  Button,
  ColorSwatch,
  DialogContent,
  GRADIENT_PRESETS,
  TextField,
} from '../../design/index.ts'
import { createNotebookRecord } from '../../storage/notebooks.ts'
import { FillEditor } from '../folders/FillEditor.tsx'
import { PAPER_OPTIONS, paperPreviewStyle } from '../paper.ts'
import { FolderField } from './FolderField.tsx'

const COVERS: { name: string; fill: Fill }[] = [
  { name: 'Mocha', fill: { type: 'solid', color: '#795a46' } },
  { name: 'Caramel', fill: { type: 'solid', color: '#b98b65' } },
  { name: 'Sage', fill: { type: 'solid', color: '#8fc172' } },
  { name: 'Ocean', fill: { type: 'solid', color: '#4a80c0' } },
  ...GRADIENT_PRESETS,
]

/** Creating a notebook: title, folder, paper and cover (from the presets or designed freely). */
export function NewNotebookDialog({
  onCreated,
  folders,
  folderId = null,
  onFoldersChanged,
}: {
  onCreated: (id: string) => void
  folders: readonly Folder[]
  /** The folder chosen at first, e.g. the one it is created from. */
  folderId?: Id | null
  /** A folder was made from inside this dialog. */
  onFoldersChanged?: () => void
}) {
  const [title, setTitle] = useState('')
  const [paper, setPaper] = useState<PaperKind>('lined')
  const [cover, setCover] = useState<Fill>(COVERS[0]!.fill)
  const [customCover, setCustomCover] = useState(false)
  const [folder, setFolder] = useState<Id | null>(folderId)
  const [extraFolders, setExtraFolders] = useState<Folder[]>([])
  const allFolders = [
    ...folders,
    ...extraFolders.filter((f) => !folders.some((g) => g.id === f.id)),
  ]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = title.trim()
    if (!name || busy) return
    setBusy(true)
    setError(null)
    try {
      const { notebook, pages } = createNotebook({ title: name, paper, cover, folderId: folder })
      await createNotebookRecord(notebook, pages)
      onCreated(notebook.id)
    } catch (err) {
      console.error(err)
      setError('The notebook could not be saved. Check that storage is not full and try again.')
      setBusy(false)
    }
  }

  return (
    <DialogContent title="New notebook">
      <form className="grid gap-6" onSubmit={submit}>
        <TextField
          label="Title"
          placeholder="e.g. Biology"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <FolderField
          folders={allFolders}
          value={folder}
          onChange={setFolder}
          onCreated={(created) => {
            setExtraFolders((list) => [...list, created])
            setFolder(created.id)
            onFoldersChanged?.()
          }}
        />

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Paper</legend>
          <div className="grid grid-cols-5 gap-3">
            {PAPER_OPTIONS.map((option) => (
              <button
                key={option.kind}
                type="button"
                aria-pressed={paper === option.kind}
                onClick={() => setPaper(option.kind)}
                className="group grid gap-1.5 text-sm"
              >
                <span
                  className={cn(
                    'aspect-[3/4] w-full rounded-lg shadow-soft ring-1 ring-line transition-shadow',
                    'group-aria-pressed:ring-2 group-aria-pressed:ring-ink',
                  )}
                  style={paperPreviewStyle(option.kind)}
                />
                <span className="text-ink-muted group-aria-pressed:font-semibold group-aria-pressed:text-ink">
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Cover</legend>
          <div className="flex items-center gap-4">
            <span
              className="aspect-[3/4] w-14 shrink-0 rounded-r-lg rounded-l-sm shadow-raised"
              style={{ background: fillToCss(cover) }}
            />
            <div role="group" aria-label="Cover colors" className="flex min-w-0 flex-wrap">
              {COVERS.map((c) => (
                <ColorSwatch
                  key={c.name}
                  label={c.name}
                  fill={c.fill}
                  selected={!customCover && cover === c.fill}
                  onSelect={() => {
                    setCustomCover(false)
                    setCover(c.fill)
                  }}
                />
              ))}
              <button
                type="button"
                aria-pressed={customCover}
                onClick={() => setCustomCover(!customCover)}
                className="m-1 flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1 ring-line hover:bg-hover aria-pressed:bg-ink aria-pressed:text-ink-inverse"
              >
                <Paintbrush size={16} /> Design
              </button>
            </div>
          </div>
          {customCover ? <FillEditor value={cover} onChange={setCover} /> : null}
        </fieldset>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end">
          <Button variant="primary" type="submit" disabled={!title.trim() || busy}>
            {busy ? 'Creating…' : 'Create notebook'}
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}
