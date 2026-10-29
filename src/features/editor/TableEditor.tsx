import { Divide, Minus, Plus, Sigma } from 'lucide-react'
import { useState } from 'react'
import type { Editor } from '../../engine/editor/Editor.ts'
import {
  addColumn,
  addRow,
  addSummaryRow,
  fitToPage,
  removeColumn,
  removeRow,
  setCell,
} from '../../engine/model/table.ts'
import type { TableObject } from '../../engine/model/types.ts'
import { ObjectPreview } from './ObjectPreview.tsx'
import { EditDialog, EditSection, EditTabs } from './EditDialog.tsx'
import { changed } from './changed.ts'
import { Button, ColorPicker, Dialog, IconButton, Slider, Switch } from '../../design/index.ts'

/**
 * Edits a table: the text of every cell, rows and columns, and how it looks. Changes are kept
 * as a draft and saved together, as one undo step.
 */
export function TableEditor({
  editor,
  table,
  open,
  onOpenChange,
}: {
  editor: Editor
  table: TableObject
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <TableEditorContent editor={editor} table={table} onDone={() => onOpenChange(false)} />
      ) : null}
    </Dialog>
  )
}

function TableEditorContent({
  editor,
  table,
  onDone,
}: {
  editor: Editor
  table: TableObject
  onDone: () => void
}) {
  const [draft, setDraft] = useState(table)
  const [tab, setTab] = useState<'cells' | 'style'>('cells')
  const style = draft.style
  const setStyle = (patch: Partial<TableObject['style']>) =>
    setDraft((t) => ({ ...t, style: { ...t.style, ...patch } }))

  const save = () => {
    editor.updateSelectedObject(
      fitToPage(draft, editor.pageSize.width, editor.pageSize.height),
      'Edit table',
    )
    onDone()
  }

  return (
    <EditDialog
      title="Edit table"
      className="w-[min(48rem,calc(100%-2rem))]"
      dirty={changed(table, draft)}
      onSave={save}
      onCancel={onDone}
      preview={<ObjectPreview object={draft} height={150} />}
      tabs={
        <EditTabs
          label="Table editor"
          value={tab}
          options={[
            ['cells', 'Cells'],
            ['style', 'Look'],
          ]}
          onChange={setTab}
        />
      }
    >
      {tab === 'cells' ? (
        <div className="grid gap-3">
          <div className="overflow-x-auto pb-1">
            <table className="border-separate border-spacing-1">
              <tbody>
                {draft.cells.map((row, r) => (
                  <tr key={r}>
                    {row.map((text, c) => (
                      <td key={c}>
                        <input
                          aria-label={`Row ${r + 1}, column ${c + 1}`}
                          value={text}
                          onChange={(e) => setDraft((t) => setCell(t, r, c, e.target.value))}
                          className="h-10 w-28 rounded-control bg-surface-raised px-2 text-sm ring-1 ring-line ring-inset focus:ring-2 focus:ring-accent focus:outline-none data-[header=true]:font-bold"
                          data-header={style.header && r === 0}
                        />
                      </td>
                    ))}
                    <td>
                      <IconButton
                        label={`Remove row ${r + 1}`}
                        icon={<Minus size={16} />}
                        disabled={draft.rows.length <= 1}
                        onClick={() => setDraft((t) => removeRow(t, r))}
                      />
                    </td>
                  </tr>
                ))}
                <tr>
                  {draft.columns.map((_, c) => (
                    <td key={c} className="text-center">
                      <IconButton
                        label={`Remove column ${c + 1}`}
                        icon={<Minus size={16} />}
                        disabled={draft.columns.length <= 1}
                        onClick={() => setDraft((t) => removeColumn(t, c))}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Plus size={16} />} onClick={() => setDraft((t) => addRow(t))}>
              Row below
            </Button>
            <Button icon={<Plus size={16} />} onClick={() => setDraft((t) => addColumn(t))}>
              Column right
            </Button>
            <Button
              icon={<Sigma size={16} />}
              onClick={() => setDraft((t) => addSummaryRow(t, 'sum'))}
            >
              Totals row
            </Button>
            <Button
              icon={<Divide size={16} />}
              onClick={() => setDraft((t) => addSummaryRow(t, 'average'))}
            >
              Average row
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            New rows and columns repeat the size of the last one, so a drawn table keeps its
            spacing. A totals or average row adds up every column with numbers.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-4">
            <Switch
              label="Header row"
              hint="The first row is filled and bold"
              checked={style.header}
              onChange={(header) => setStyle({ header })}
            />
            <Slider
              label="Text size"
              value={Math.round(style.fontSize)}
              min={6}
              max={32}
              onChange={(fontSize) => setStyle({ fontSize })}
              format={(v) => `${v} pt`}
            />
            <Slider
              label="Line thickness"
              value={Math.round(style.lineWidth * 4) / 4}
              min={0.25}
              max={6}
              step={0.25}
              onChange={(lineWidth) => setStyle({ lineWidth })}
              format={(v) => `${v.toFixed(1)} pt`}
            />
          </div>
          <div className="grid content-start gap-5">
            <EditSection title="Line color">
              <ColorPicker
                value={style.lineColor}
                onChange={(lineColor) => setStyle({ lineColor })}
              />
            </EditSection>
            <EditSection title="Text color">
              <ColorPicker
                value={style.textColor}
                onChange={(textColor) => setStyle({ textColor })}
              />
            </EditSection>
            {style.header ? (
              <EditSection title="Header fill">
                <ColorPicker
                  value={style.headerFill}
                  onChange={(headerFill) => setStyle({ headerFill })}
                />
              </EditSection>
            ) : null}
          </div>
        </div>
      )}
    </EditDialog>
  )
}
