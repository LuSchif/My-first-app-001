import { useState } from 'react'
import { createNotebook } from '../../engine/model/factory.ts'
import { SLIDE_SIZES, type Folder, type Id } from '../../engine/model/types.ts'
import { Button, ColorSwatch, DialogContent, DialogFooter, TextField } from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'
import { createNotebookRecord } from '../../storage/notebooks.ts'
import { FolderField } from './FolderField.tsx'

const BACKGROUNDS = [
  ['White', '#ffffff'],
  ['Paper', '#fffdf8'],
  ['Sand', '#f2e8da'],
  ['Mist', '#eef2f6'],
  ['Sage', '#e9f0e4'],
  ['Espresso', '#3e2d25'],
  ['Night', '#1f2633'],
] as const

const FORMATS = [
  ['wide', 'Widescreen', '16:9'],
  ['standard', 'Standard', '4:3'],
] as const

/** Creating a presentation: title, folder, slide format and the slides' background. */
export function NewPresentationDialog({
  onCreated,
  folders,
  folderId = null,
  onFoldersChanged,
}: {
  onCreated: (id: string) => void
  folders: readonly Folder[]
  folderId?: Id | null
  onFoldersChanged?: () => void
}) {
  const [title, setTitle] = useState('')
  const [format, setFormat] = useState<keyof typeof SLIDE_SIZES>('wide')
  const [background, setBackground] = useState<string>(BACKGROUNDS[0][1])
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
      const { notebook, pages } = createNotebook({
        title: name,
        paper: 'blank',
        cover: { type: 'solid', color: background },
        folderId: folder,
        kind: 'presentation',
        pageSize: SLIDE_SIZES[format],
      })
      notebook.background = background
      await createNotebookRecord(notebook, pages)
      onCreated(notebook.id)
    } catch (err) {
      console.error(err)
      setError('The presentation could not be saved. Check that storage is not full and try again.')
      setBusy(false)
    }
  }

  return (
    <DialogContent title="New presentation" className="w-[min(36rem,calc(100%-2rem))]">
      <form className="grid gap-6" onSubmit={submit}>
        <TextField
          label="Title"
          placeholder="e.g. Photosynthesis"
          value={title}
          maxLength={80}
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
          <legend className="mb-2 text-sm font-medium">Slide format</legend>
          <div className="grid grid-cols-2 gap-3">
            {FORMATS.map(([key, label, ratio]) => (
              <button
                key={key}
                type="button"
                aria-pressed={format === key}
                onClick={() => setFormat(key)}
                className="group grid justify-items-center gap-2 rounded-card p-3 ring-1 ring-line aria-pressed:ring-2 aria-pressed:ring-ink"
              >
                <span
                  className="w-28 rounded-md shadow-soft ring-1 ring-line"
                  style={{
                    background,
                    aspectRatio: `${SLIDE_SIZES[key].width} / ${SLIDE_SIZES[key].height}`,
                  }}
                />
                <span className="text-sm">
                  <span className="font-semibold">{label}</span>{' '}
                  <span className="text-ink-muted">{ratio}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Background</legend>
          <div role="group" aria-label="Slide background" className={cn('-m-1 flex flex-wrap')}>
            {BACKGROUNDS.map(([name, color]) => (
              <ColorSwatch
                key={color}
                label={name}
                fill={{ type: 'solid', color }}
                selected={background === color}
                onSelect={() => setBackground(color)}
              />
            ))}
          </div>
        </fieldset>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <DialogFooter>
          <Button variant="primary" type="submit" disabled={!title.trim() || busy}>
            {busy ? 'Creating…' : 'Create presentation'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
