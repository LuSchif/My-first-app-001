import { useState } from 'react'
import { createNotebook, createPage } from '../../engine/model/factory.ts'
import { CARD_SIZE, type Folder, type Id } from '../../engine/model/types.ts'
import { Button, ColorSwatch, DialogContent, DialogFooter, TextField } from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'
import { createNotebookRecord } from '../../storage/notebooks.ts'
import { FolderField } from '../library/FolderField.tsx'
import { NameHint } from '../library/NameHint.tsx'
import { useTakenNames } from '../library/useTakenNames.ts'
import { uniqueName } from '../library/uniqueName.ts'

const CARD_COLORS = [
  ['White', '#ffffff'],
  ['Paper', '#fffdf8'],
  ['Lemon', '#fbf3c8'],
  ['Mint', '#e3f2e1'],
  ['Sky', '#e2eef8'],
  ['Rose', '#f8e4ea'],
  ['Lilac', '#ece6f6'],
] as const

/** Creating a deck of flashcards: title, folder and the cards' color. It starts with one card. */
export function NewDeckDialog({
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
  const taken = useTakenNames('deck')
  const [background, setBackground] = useState<string>(CARD_COLORS[0][1])
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
    const name = uniqueName(title, taken)
    if (!name || busy) return
    setBusy(true)
    setError(null)
    try {
      const { notebook, pages } = createNotebook({
        title: name,
        paper: 'blank',
        cover: { type: 'solid', color: background },
        folderId: folder,
        kind: 'deck',
        pageSize: CARD_SIZE,
      })
      notebook.background = background
      // The first card: its front is the page made with the deck, then its back.
      const back = createPage(notebook.id, 'blank')
      notebook.pageIds.push(back.id)
      await createNotebookRecord(notebook, [...pages, back])
      onCreated(notebook.id)
    } catch (err) {
      console.error(err)
      setError('The flashcards could not be saved. Check that storage is not full and try again.')
      setBusy(false)
    }
  }

  return (
    <DialogContent title="New flashcards" className="w-[min(36rem,calc(100%-2rem))]">
      <form className="grid gap-6" onSubmit={submit}>
        <TextField
          label="Title"
          placeholder="e.g. French vocabulary"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
        />
        <NameHint name={title} taken={taken} noun="deck of flashcards" />
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
          <legend className="mb-1 text-sm font-medium">Card color</legend>
          <div className="flex flex-wrap items-center gap-4">
            <span
              className="w-36 rounded-md shadow-soft ring-1 ring-line"
              style={{ background, aspectRatio: `${CARD_SIZE.width} / ${CARD_SIZE.height}` }}
            />
            <div role="group" aria-label="Card color" className={cn('-m-1 flex flex-wrap')}>
              {CARD_COLORS.map(([name, color]) => (
                <ColorSwatch
                  key={color}
                  label={name}
                  fill={{ type: 'solid', color }}
                  selected={background === color}
                  onSelect={() => setBackground(color)}
                />
              ))}
            </div>
          </div>
        </fieldset>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <DialogFooter>
          <Button variant="primary" type="submit" disabled={!title.trim() || busy}>
            {busy ? 'Creating…' : 'Create flashcards'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
