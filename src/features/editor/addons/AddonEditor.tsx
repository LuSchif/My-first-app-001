import { useState, type ReactNode } from 'react'
import {
  Button,
  ColorSwatch,
  DialogContent,
  DialogFooter,
  PRIMARY_COLORS,
  Slider,
  Switch,
  TextField,
} from '../../../design/index.ts'
import { formatDate, formatTime, pageNumberText } from '../../../engine/addons/decorations.ts'
import {
  SPOTS,
  type Addon,
  type AutoRotateSettings,
  type DateTimeSettings,
  type GestureSettings,
  type GestureStroke,
  type PageNumberSettings,
  type Spot,
} from '../../../engine/addons/types.ts'
import type { Editor } from '../../../engine/editor/Editor.ts'
import { cn } from '../../../lib/cn.ts'
import { DrawPad } from './DrawPad.tsx'
import { angleText } from './text.ts'
import { freeName } from './store.ts'

/**
 * The edit window of an addon: its name, whether it is always on, and everything it does.
 * Opened inside a Dialog; `onSave` gets the changed addon.
 */
export function AddonEditor({
  addon,
  editor,
  isNew,
  onSave,
  onCancel,
}: {
  addon: Addon
  editor: Editor
  isNew: boolean
  onSave: (addon: Addon) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<Addon>(addon)
  const ready = draft.kind !== 'gesture' || gestureReady(draft.settings)
  return (
    <DialogContent
      title={isNew ? 'New addon' : `Edit “${addon.name}”`}
      description={DESCRIPTIONS[draft.kind]}
      className="max-w-xl"
    >
      <div className="grid max-h-[min(70dvh,40rem)] gap-5 overflow-y-auto pr-1">
        <TextField
          label="Name"
          value={draft.name}
          maxLength={40}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <Switch
          label="Always active"
          hint="On in every notebook, without switching it on."
          checked={draft.always}
          onChange={(always) => setDraft({ ...draft, always })}
        />
        {draft.kind === 'dateTime' ? (
          <DateTimeForm
            value={draft.settings}
            onChange={(settings) => setDraft({ ...draft, settings })}
          />
        ) : draft.kind === 'pageNumbers' ? (
          <PageNumberForm
            value={draft.settings}
            onChange={(settings) => setDraft({ ...draft, settings })}
          />
        ) : draft.kind === 'autoRotate' ? (
          <AutoRotateForm
            value={draft.settings}
            editor={editor}
            onChange={(settings) => setDraft({ ...draft, settings })}
          />
        ) : (
          <GestureForm
            value={draft.settings}
            onChange={(settings) => setDraft({ ...draft, settings })}
          />
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!ready}
          onClick={() =>
            onSave({ ...draft, name: freeName(draft.name.trim() || addon.name, draft.id) } as Addon)
          }
        >
          {isNew ? 'Add to my addons' : 'Save'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

const DESCRIPTIONS: Record<Addon['kind'], string> = {
  dateTime: 'Today’s date and the time on every page. Choose where they go and how they look.',
  pageNumbers: 'A number on every page, from the page you choose.',
  autoRotate:
    'While it is on, pages, pictures and elements you add are turned by this angle. Switch it on only when what you add comes in crooked.',
  gesture:
    'Draw what you will draw on the page, then what it should become. Whenever this addon is on and you draw the first, it turns into the second, fitted to where you drew it.',
}

function gestureReady(s: GestureSettings): boolean {
  return s.before.length > 0 && s.after.length > 0
}

// ---------- Forms ----------

function DateTimeForm({
  value,
  onChange,
}: {
  value: DateTimeSettings
  onChange: (v: DateTimeSettings) => void
}) {
  const set = (patch: Partial<DateTimeSettings>) => onChange({ ...value, ...patch })
  const [now] = useState(() => new Date())
  return (
    <>
      <Section title="Date">
        <Switch
          label="Show the date"
          checked={value.showDate}
          onChange={(showDate) => set({ showDate })}
        />
        {value.showDate ? (
          <>
            <Choice
              label="Style"
              value={value.dateStyle}
              options={[
                ['long', formatDate(now, 'long')],
                ['short', formatDate(now, 'short')],
                ['numeric', formatDate(now, 'numeric')],
              ]}
              onChange={(dateStyle) => set({ dateStyle })}
            />
            <SpotPicker
              label="Where"
              value={value.dateSpot}
              onChange={(dateSpot) => set({ dateSpot })}
            />
          </>
        ) : null}
      </Section>
      <Section title="Time">
        <Switch
          label="Show the time"
          checked={value.showTime}
          onChange={(showTime) => set({ showTime })}
        />
        {value.showTime ? (
          <SpotPicker
            label="Where"
            value={value.timeSpot}
            onChange={(timeSpot) => set({ timeSpot })}
          />
        ) : null}
      </Section>
      <LookForm value={value} onChange={set} />
      <Preview>
        {[
          value.showDate ? formatDate(now, value.dateStyle) : '',
          value.showTime ? formatTime(now) : '',
        ]
          .filter(Boolean)
          .join(' · ') || 'Nothing shown'}
      </Preview>
    </>
  )
}

function PageNumberForm({
  value,
  onChange,
}: {
  value: PageNumberSettings
  onChange: (v: PageNumberSettings) => void
}) {
  const set = (patch: Partial<PageNumberSettings>) => onChange({ ...value, ...patch })
  const sample = (style: PageNumberSettings['style']) =>
    pageNumberText({ ...value, style, startPage: 1, firstNumber: 3 }, 0, 10)
  return (
    <>
      <Section title="Numbers">
        <Choice
          label="Style"
          value={value.style}
          options={[
            ['plain', sample('plain')],
            ['page', sample('page')],
            ['of', sample('of')],
            ['dashes', sample('dashes')],
          ]}
          onChange={(style) => set({ style })}
        />
        <SpotPicker label="Where" value={value.spot} onChange={(spot) => set({ spot })} />
        <Slider
          label="Numbering starts on page"
          value={value.startPage}
          min={1}
          max={30}
          onChange={(startPage) => set({ startPage })}
        />
        <Slider
          label="That page is number"
          value={value.firstNumber}
          min={0}
          max={30}
          onChange={(firstNumber) => set({ firstNumber })}
        />
      </Section>
      <LookForm value={value} onChange={set} />
    </>
  )
}

function AutoRotateForm({
  value,
  editor,
  onChange,
}: {
  value: AutoRotateSettings
  editor: Editor
  onChange: (v: AutoRotateSettings) => void
}) {
  const set = (patch: Partial<AutoRotateSettings>) => onChange({ ...value, ...patch })
  return (
    <>
      <Section title="Angle">
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-card bg-surface-sunken">
            <span
              className="block h-9 w-7 rounded-[3px] bg-surface-raised shadow-raised ring-1 ring-line transition-transform"
              style={{ transform: `rotate(${value.angle}deg)` }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <Slider
              label="Turn by"
              value={value.angle}
              min={-180}
              max={180}
              step={5}
              onChange={(angle) => set({ angle })}
              format={angleText}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[-90, -45, 45, 90, 180].map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={value.angle === a}
              onClick={() => set({ angle: a })}
              className="h-9 rounded-control px-3 text-sm font-semibold ring-1 ring-line hover:bg-hover aria-pressed:bg-ink aria-pressed:text-ink-inverse"
            >
              {a > 0 ? `${a}° ↻` : `${-a}° ↺`}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Turns">
        <Switch
          label="Pages you add"
          hint="From another notebook."
          checked={value.pages}
          onChange={(pages) => set({ pages })}
        />
        <Switch
          label="Pictures and photos"
          checked={value.pictures}
          onChange={(pictures) => set({ pictures })}
        />
        <Switch
          label="Elements"
          hint="Shapes, stickers, tables, charts and things taken out of other notebooks."
          checked={value.elements}
          onChange={(elements) => set({ elements })}
        />
      </Section>
      <Section title="Already on the page">
        <Button
          className="justify-self-start"
          onClick={() => editor.rotatePageContents(value.angle)}
        >
          Turn the page in view now
        </Button>
      </Section>
    </>
  )
}

const AFTER_TOOLS = [
  ['highlighter', 'Highlighter', 18],
  ['pen', 'Pen', 3],
] as const

function GestureForm({
  value,
  onChange,
}: {
  value: GestureSettings
  onChange: (v: GestureSettings) => void
}) {
  const set = (patch: Partial<GestureSettings>) => onChange({ ...value, ...patch })
  const [tool, setTool] = useState<GestureStroke['tool']>('highlighter')
  const [color, setColor] = useState('#f2cf4a')
  const width = AFTER_TOOLS.find(([t]) => t === tool)![2]
  return (
    <>
      <Section title="When you draw">
        <DrawPad
          label="When you draw"
          strokes={value.before}
          onChange={(before) => set({ before })}
          pen={{ tool: 'pen', color: '#3e2d25', width: 3 }}
        />
        <PadFooter
          count={value.before.length}
          hint="E.g. two brackets. Draw each stroke as you would on the page."
          onUndo={() => set({ before: value.before.slice(0, -1) })}
          onClear={() => set({ before: [] })}
        />
      </Section>
      <Section title="It becomes">
        <div className="flex flex-wrap items-center gap-2">
          {AFTER_TOOLS.map(([t, label]) => (
            <button
              key={t}
              type="button"
              aria-pressed={tool === t}
              onClick={() => {
                setTool(t)
                setColor(t === 'highlighter' ? '#f2cf4a' : '#3e2d25')
              }}
              className="h-9 rounded-control px-3 text-sm font-semibold ring-1 ring-line hover:bg-hover aria-pressed:bg-ink aria-pressed:text-ink-inverse"
            >
              {label}
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-line" />
          {(tool === 'highlighter'
            ? MARKER_COLORS
            : PRIMARY_COLORS.map(([, c]) => c).slice(0, 6)
          ).map((c) => (
            <ColorSwatch
              key={c}
              size="sm"
              label={c}
              fill={{ type: 'solid', color: c }}
              selected={color === c}
              onSelect={() => setColor(c)}
            />
          ))}
        </div>
        <DrawPad
          label="It becomes"
          strokes={value.after}
          ghost={value.before}
          onChange={(after) => set({ after })}
          pen={{ tool, color, width }}
        />
        <PadFooter
          count={value.after.length}
          hint="Your first drawing shows faintly: draw the result in its place, e.g. a highlight between the brackets."
          onUndo={() => set({ after: value.after.slice(0, -1) })}
          onClear={() => set({ after: [] })}
        />
      </Section>
      <Section title="Details">
        <Switch
          label="Keep what I drew"
          hint="Off: your drawing is replaced by the result. On: the result is added to it."
          checked={value.keepBefore}
          onChange={(keepBefore) => set({ keepBefore })}
        />
        <Slider
          label="How exactly it must match"
          value={Math.round((1 - value.tolerance) * 100)}
          min={0}
          max={100}
          step={10}
          onChange={(v) => set({ tolerance: 1 - v / 100 })}
          format={(v) => (v >= 70 ? 'Strict' : v <= 30 ? 'Loose' : 'Normal')}
        />
      </Section>
    </>
  )
}

const MARKER_COLORS = ['#f2cf4a', '#a8d8a0', '#9fd0e8', '#f3a6b8', '#f6b26b', '#c9b3e6']

function PadFooter({
  count,
  hint,
  onUndo,
  onClear,
}: {
  count: number
  hint: string
  onUndo: () => void
  onClear: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="text-xs text-ink-muted">
        {count ? `${count} ${count === 1 ? 'stroke' : 'strokes'}. ` : ''}
        {hint}
      </p>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" disabled={!count} onClick={onUndo}>
          Undo
        </Button>
        <Button variant="ghost" disabled={!count} onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  )
}

// ---------- Parts ----------

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-sm font-bold">{title}</h3>
      {children}
    </section>
  )
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className="min-h-9 rounded-control px-3 text-sm font-semibold ring-1 ring-line hover:bg-hover aria-checked:bg-ink aria-checked:text-ink-inverse"
        >
          {text}
        </button>
      ))}
    </div>
  )
}

const SPOT_LABELS: Record<Spot, string> = {
  'top-left': 'Top left',
  'top-center': 'Top middle',
  'top-right': 'Top right',
  'bottom-left': 'Bottom left',
  'bottom-center': 'Bottom middle',
  'bottom-right': 'Bottom right',
}

/** A small page with the six places a label can go. */
function SpotPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: Spot
  onChange: (s: Spot) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-ink-muted">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid h-24 w-[4.25rem] grid-cols-3 content-between rounded-[4px] bg-surface-raised p-1 shadow-raised ring-1 ring-line"
      >
        {SPOTS.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            aria-label={SPOT_LABELS[s]}
            onClick={() => onChange(s)}
            className="grid h-6 place-items-center rounded-[3px] hover:bg-hover"
          >
            <span
              className={cn('h-1.5 w-3 rounded-full', value === s ? 'bg-accent' : 'bg-line-strong')}
            />
          </button>
        ))}
      </div>
      <span className="text-sm font-semibold">{SPOT_LABELS[value]}</span>
    </div>
  )
}

/** Color, size and the marker band of a label. */
function LookForm<T extends { color: string; size: number; marked: boolean; markColor: string }>({
  value,
  onChange,
}: {
  value: T
  onChange: (patch: Partial<T>) => void
}) {
  return (
    <Section title="Look">
      <div className="flex flex-wrap gap-1">
        {PRIMARY_COLORS.map(([name, c]) => (
          <ColorSwatch
            key={c}
            size="sm"
            label={name}
            fill={{ type: 'solid', color: c }}
            selected={value.color === c}
            onSelect={() => onChange({ color: c } as Partial<T>)}
          />
        ))}
      </div>
      <Slider
        label="Size"
        value={value.size}
        min={8}
        max={28}
        onChange={(size) => onChange({ size } as Partial<T>)}
        format={(v) => `${v} pt`}
      />
      <Switch
        label="Marked"
        hint="On a band of highlighter color."
        checked={value.marked}
        onChange={(marked) => onChange({ marked } as Partial<T>)}
      />
      {value.marked ? (
        <div className="flex flex-wrap gap-1">
          {MARKER_COLORS.map((c) => (
            <ColorSwatch
              key={c}
              size="sm"
              label={c}
              fill={{ type: 'solid', color: c }}
              selected={value.markColor === c}
              onSelect={() => onChange({ markColor: c } as Partial<T>)}
            />
          ))}
        </div>
      ) : null}
    </Section>
  )
}

function Preview({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-card bg-surface-sunken px-3 py-2 text-sm text-ink-muted">
      Today it shows: <span className="font-semibold text-ink">{children}</span>
    </p>
  )
}
