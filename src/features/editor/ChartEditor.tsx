import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowLeftRight,
  ArrowUpNarrowWide,
  Minus,
  Plus,
} from 'lucide-react'
import { useState } from 'react'
import type { Editor } from '../../engine/editor/Editor.ts'
import {
  addCategory,
  addSeries,
  CHART_COLORS,
  CHART_KINDS,
  removeCategory,
  removeSeries,
  seriesStats,
  setValue,
  sortChart,
  transposeChart,
} from '../../engine/model/chart.ts'
import { formatValue } from '../../engine/render/chart.ts'
import type { ChartObject } from '../../engine/model/types.ts'
import {
  Button,
  ColorSwatch,
  Dialog,
  DialogContent,
  IconButton,
  Slider,
  Switch,
  TextField,
} from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'
import { CHART_ICONS } from './chartIcons.tsx'
import { ObjectPreview } from './ObjectPreview.tsx'

/**
 * Edits a chart: its type, title, data and look. Changes are kept as a draft and saved
 * together, as one undo step.
 */
export function ChartEditor({
  editor,
  chart,
  open,
  onOpenChange,
}: {
  editor: Editor
  chart: ChartObject
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ChartEditorContent editor={editor} chart={chart} onDone={() => onOpenChange(false)} />
      ) : null}
    </Dialog>
  )
}

function ChartEditorContent({
  editor,
  chart,
  onDone,
}: {
  editor: Editor
  chart: ChartObject
  onDone: () => void
}) {
  const [draft, setDraft] = useState(chart)
  const round = draft.kind === 'pie' || draft.kind === 'donut'
  // Pie and donut charts show the first series only.
  const shown = round ? draft.series.slice(0, 1) : draft.series

  return (
    <DialogContent title="Edit chart" className="w-[min(48rem,calc(100%-2rem))]">
      <div className="grid gap-5">
        <ObjectPreview object={draft} height={190} />
        <div role="group" aria-label="Chart type" className="grid grid-cols-4 gap-2">
          {CHART_KINDS.map(({ kind, label }) => (
            <button
              key={kind}
              type="button"
              aria-pressed={draft.kind === kind}
              onClick={() => setDraft((c) => ({ ...c, kind }))}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-control text-xs font-semibold ring-1 ring-line aria-pressed:bg-ink aria-pressed:text-ink-inverse aria-pressed:ring-ink"
            >
              {CHART_ICONS[kind]}
              {label}
            </button>
          ))}
        </div>

        <TextField
          label="Title"
          value={draft.title}
          placeholder="No title"
          onChange={(e) => setDraft((c) => ({ ...c, title: e.target.value }))}
        />

        <div className="grid gap-2">
          <p className="text-sm font-semibold">Data</p>
          <div className="overflow-x-auto pb-1">
            <table className="border-separate border-spacing-1">
              <thead>
                <tr>
                  <th />
                  {shown.map((s, k) => (
                    <th key={k} className="text-left align-bottom">
                      <div className="flex items-center gap-1">
                        <input
                          aria-label={`Name of series ${k + 1}`}
                          value={s.name}
                          onChange={(e) =>
                            setDraft((c) => ({
                              ...c,
                              series: c.series.map((x, i) =>
                                i === k ? { ...x, name: e.target.value } : x,
                              ),
                            }))
                          }
                          className="h-10 w-28 rounded-control bg-surface-raised px-2 text-sm font-semibold ring-1 ring-line ring-inset focus:ring-2 focus:ring-accent focus:outline-none"
                        />
                        {!round && draft.series.length > 1 ? (
                          <IconButton
                            label={`Remove ${s.name}`}
                            icon={<Minus size={16} />}
                            onClick={() => setDraft((c) => removeSeries(c, k))}
                          />
                        ) : null}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.labels.map((label, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        aria-label={`Label ${i + 1}`}
                        value={label}
                        onChange={(e) =>
                          setDraft((c) => ({
                            ...c,
                            labels: c.labels.map((l, j) => (j === i ? e.target.value : l)),
                          }))
                        }
                        className="h-10 w-28 rounded-control bg-surface-sunken px-2 text-sm ring-1 ring-line ring-inset focus:ring-2 focus:ring-accent focus:outline-none"
                      />
                    </td>
                    {shown.map((s, k) => (
                      <td key={k}>
                        <NumberField
                          label={`${s.name}, ${label}`}
                          value={s.values[i] ?? 0}
                          onChange={(v) => setDraft((c) => setValue(c, k, i, v))}
                        />
                      </td>
                    ))}
                    <td>
                      <IconButton
                        label={`Remove ${label || `row ${i + 1}`}`}
                        icon={<Minus size={16} />}
                        disabled={draft.labels.length <= 1}
                        onClick={() => setDraft((c) => removeCategory(c, i))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Plus size={16} />} onClick={() => setDraft((c) => addCategory(c))}>
              {round ? 'Slice' : 'Category'}
            </Button>
            {round ? null : (
              <Button icon={<Plus size={16} />} onClick={() => setDraft((c) => addSeries(c))}>
                Series
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-semibold">Arrange</p>
          <div className="flex flex-wrap gap-2">
            <Button
              icon={<ArrowDownAZ size={16} />}
              onClick={() => setDraft((c) => sortChart(c, 'label'))}
            >
              A–Z
            </Button>
            <Button
              icon={<ArrowUpNarrowWide size={16} />}
              onClick={() => setDraft((c) => sortChart(c, 'ascending'))}
            >
              Smallest first
            </Button>
            <Button
              icon={<ArrowDownWideNarrow size={16} />}
              onClick={() => setDraft((c) => sortChart(c, 'descending'))}
            >
              Largest first
            </Button>
            {round ? null : (
              <Button
                icon={<ArrowLeftRight size={16} />}
                onClick={() => setDraft((c) => transposeChart(c))}
              >
                Transpose
              </Button>
            )}
          </div>
          <p className="text-xs text-ink-muted">
            Sorting goes by the first series. Transpose swaps categories and series.
          </p>
        </div>

        <Stats chart={draft} series={shown} />

        {round ? null : (
          <div className="grid gap-2">
            <p className="text-sm font-semibold">Colors</p>
            {draft.series.map((s, k) => (
              <div key={k} className="flex flex-wrap items-center gap-2">
                <span className="w-24 truncate text-sm">{s.name}</span>
                {CHART_COLORS.map((color) => (
                  <ColorSwatch
                    key={color}
                    size="sm"
                    label={`${s.name}: ${color}`}
                    fill={{ type: 'solid', color }}
                    selected={s.color === color}
                    onSelect={() =>
                      setDraft((c) => ({
                        ...c,
                        series: c.series.map((x, i) => (i === k ? { ...x, color } : x)),
                      }))
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-1 sm:grid-cols-2 sm:gap-x-6">
          <Switch
            label="Legend"
            checked={draft.legend}
            onChange={(legend) => setDraft((c) => ({ ...c, legend }))}
          />
          <Switch
            label="Values"
            hint={round ? 'Percent on each slice' : 'Numbers on bars and points'}
            checked={draft.values}
            onChange={(values) => setDraft((c) => ({ ...c, values }))}
          />
          {draft.kind === 'bar' && draft.series.length > 1 ? (
            <Switch
              label="Stacked bars"
              hint="Series on top of each other"
              checked={Boolean(draft.stacked)}
              onChange={(stacked) => setDraft((c) => ({ ...c, stacked }))}
            />
          ) : null}
          {round ? null : (
            <Switch
              label="Average line"
              hint="A dashed line at each series' average"
              checked={Boolean(draft.average)}
              onChange={(average) => setDraft((c) => ({ ...c, average }))}
            />
          )}
          {round ? null : (
            <Switch
              label="Grid lines"
              checked={draft.grid}
              onChange={(grid) => setDraft((c) => ({ ...c, grid }))}
            />
          )}
          <div className="py-2">
            <Slider
              label="Text size"
              value={Math.round(draft.fontSize)}
              min={6}
              max={24}
              onChange={(fontSize) => setDraft((c) => ({ ...c, fontSize }))}
              format={(v) => `${v} pt`}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            editor.updateSelectedObject(draft, 'Edit chart')
            onDone()
          }}
        >
          Done
        </Button>
      </div>
    </DialogContent>
  )
}

/** Sum, average, smallest and largest value of each series. */
function Stats({ chart, series }: { chart: ChartObject; series: ChartObject['series'] }) {
  const rows = series.flatMap((s) => {
    const stats = seriesStats(s.values.slice(0, chart.labels.length))
    return stats ? [{ name: s.name, color: s.color, ...stats }] : []
  })
  if (rows.length === 0) return null
  const cell = 'px-2 py-1.5 text-right tabular-nums'
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold">Calculations</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-ink-muted">
            <tr>
              <th className="px-2 py-1 text-left font-medium">Series</th>
              <th className={cn(cell, 'font-medium')}>Sum</th>
              <th className={cn(cell, 'font-medium')}>Average</th>
              <th className={cn(cell, 'font-medium')}>Min</th>
              <th className={cn(cell, 'font-medium')}>Max</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-line">
                <td className="px-2 py-1.5">
                  <span
                    className="mr-2 inline-block size-2.5 rounded-sm"
                    style={{ background: r.color }}
                  />
                  {r.name}
                </td>
                <td className={cell}>{formatValue(r.sum)}</td>
                <td className={cell}>{formatValue(Math.round(r.average * 100) / 100)}</td>
                <td className={cell}>{formatValue(r.min)}</td>
                <td className={cell}>{formatValue(r.max)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** A number input that allows typing "-" or "1." on the way to a number. */
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  const [text, setText] = useState<string | null>(null)
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={text ?? String(value)}
      onChange={(e) => {
        setText(e.target.value)
        const v = Number(e.target.value.replace(',', '.'))
        if (e.target.value.trim() !== '' && Number.isFinite(v)) onChange(v)
      }}
      onBlur={() => setText(null)}
      className={cn(
        'h-10 w-24 rounded-control bg-surface-raised px-2 text-right text-sm tabular-nums',
        'ring-1 ring-line ring-inset focus:ring-2 focus:ring-accent focus:outline-none',
      )}
    />
  )
}
