import { useState } from 'react'
import { createNotebook } from '../../engine/model/factory.ts'
import { createQuiz } from '../../engine/model/quiz.ts'
import type { Folder, Id } from '../../engine/model/types.ts'
import { Button, ColorSwatch, DialogContent, DialogFooter, TextField } from '../../design/index.ts'
import { createNotebookRecord } from '../../storage/notebooks.ts'
import { FolderField } from '../library/FolderField.tsx'
import { NameHint } from '../library/NameHint.tsx'
import { uniqueName } from '../library/uniqueName.ts'
import { useTakenNames } from '../library/useTakenNames.ts'
import { QuizCover } from './QuizCover.tsx'
import { QUIZ_COLORS } from './answerColors.ts'

/** Creating a quiz: title, folder and color. It starts with one question to fill in. */
export function NewQuizDialog({
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
  const taken = useTakenNames('quiz')
  const [color, setColor] = useState<string>(QUIZ_COLORS[0][1])
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
      const { notebook } = createNotebook({
        title: name,
        paper: 'blank',
        cover: { type: 'solid', color },
        folderId: folder,
        kind: 'quiz',
      })
      // A quiz has questions instead of pages.
      notebook.pageIds = []
      notebook.layers = []
      notebook.quiz = createQuiz()
      await createNotebookRecord(notebook, [])
      onCreated(notebook.id)
    } catch (err) {
      console.error(err)
      setError('The quiz could not be saved. Check that storage is not full and try again.')
      setBusy(false)
    }
  }

  return (
    <DialogContent title="New quiz" className="w-[min(36rem,calc(100%-2rem))]">
      <form className="grid gap-6" onSubmit={submit}>
        <TextField
          label="Title"
          placeholder="e.g. Biology: the cell"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
        />
        <NameHint name={title} taken={taken} noun="quiz" />
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
          <legend className="mb-1 text-sm font-medium">Color</legend>
          <div className="flex flex-wrap items-center gap-4">
            <QuizCover color={color} title={title.trim() || 'Quiz'} count={1} className="w-40" />
            <div role="group" aria-label="Quiz color" className="-m-1 flex flex-wrap">
              {QUIZ_COLORS.map(([name, value]) => (
                <ColorSwatch
                  key={value}
                  label={name}
                  fill={{ type: 'solid', color: value }}
                  selected={color === value}
                  onSelect={() => setColor(value)}
                />
              ))}
            </div>
          </div>
        </fieldset>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <DialogFooter>
          <Button variant="primary" type="submit" disabled={!title.trim() || busy}>
            {busy ? 'Creating…' : 'Create quiz'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
