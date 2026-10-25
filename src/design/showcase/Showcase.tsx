import {
  ChartColumn,
  FolderPlus,
  Highlighter,
  Lasso,
  Layers,
  PenLine,
  Plus,
  Redo2,
  Search,
  Type,
  Undo2,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { fillToCss, prefersLightText, type Fill } from '../../engine/model/fill.ts'
import { cn } from '../../lib/cn.ts'
import {
  BroomIcon,
  Button,
  ColorSwatch,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  GRADIENT_PRESETS,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Slider,
  SwatchGrid,
  TextField,
} from '../index.ts'

/**
 * A living reference of the Broomit design system. Everything on this page is the real
 * component, so it doubles as a manual test bench on the iPad.
 */
export function Showcase() {
  return (
    <div className="min-h-full px-4 pt-10 pb-24 sm:px-8">
      <div className="mx-auto grid max-w-4xl gap-14">
        <header className="grid gap-2">
          <p className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
            Broomit
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-balance">Design system</h1>
          <p className="max-w-[60ch] text-ink-muted">
            Colors, type, icons and the building blocks of every Broomit screen. All controls on
            this page work, so you can try them with finger, pencil, mouse and keyboard.
          </p>
        </header>
        <ColorsSection />
        <TypeSection />
        <IconsSection />
        <ToolbarSection />
        <ButtonsSection />
        <FieldsSection />
        <FillsSection />
        <DialogSection />
      </div>
    </div>
  )
}

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="grid gap-5">
      <div className="grid gap-1 border-b border-line pb-3">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        <p className="text-sm text-ink-muted">{note}</p>
      </div>
      {children}
    </section>
  )
}

const BRAND = [
  ['Cream', '#F7F2EA'],
  ['Sand', '#E8D9C5'],
  ['Beige', '#D8C1A5'],
  ['Caramel', '#B98B65'],
  ['Mocha', '#795A46'],
  ['Espresso', '#3E2D25'],
] as const

const SEMANTIC = [
  ['surface', 'App background', 'bg-surface'],
  ['surface-raised', 'Panels, cards, popovers', 'bg-surface-raised'],
  ['surface-sunken', 'Wells, tracks', 'bg-surface-sunken'],
  ['ink', 'Text, active tools', 'bg-ink'],
  ['ink-muted', 'Secondary text', 'bg-ink-muted'],
  ['line', 'Borders, dividers', 'bg-line'],
  ['accent', 'Focus, highlights', 'bg-accent'],
  ['danger', 'Delete', 'bg-danger'],
] as const

function ColorsSection() {
  return (
    <Section
      title="Colors"
      note="The six brand colors build the interface. Components use the semantic names below them."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {BRAND.map(([name, hex]) => (
          <div key={name} className="grid gap-2">
            <div
              className="aspect-[4/3] rounded-card shadow-[inset_0_0_0_1px_rgb(62_45_37/0.1)]"
              style={{ background: hex }}
            />
            <div className="text-sm">
              <div className="font-semibold">{name}</div>
              <div className="text-ink-muted tabular-nums">{hex}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {SEMANTIC.map(([token, use, cls]) => (
          <div key={token} className="flex items-center gap-3">
            <span className={cn('size-8 shrink-0 rounded-lg ring-1 ring-line', cls)} />
            <span className="text-sm">
              <code className="font-semibold">{token}</code>
              <span className="text-ink-muted"> · {use}</span>
            </span>
          </div>
        ))}
      </div>
    </Section>
  )
}

function TypeSection() {
  return (
    <Section
      title="Type"
      note="Plus Jakarta Sans throughout: friendly, precise and easy to read at small sizes."
    >
      <div className="grid gap-4 rounded-card bg-surface-raised p-6 shadow-soft">
        <p className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Biology · Semester 2
        </p>
        <p className="text-2xl font-bold tracking-tight">Cell structure and function</p>
        <p className="text-xl font-semibold">Folders and notebooks</p>
        <p className="max-w-[65ch] text-base leading-relaxed">
          Body text for longer descriptions and settings. Lines stay under 65 characters, so they
          remain easy to follow on a tablet held in portrait.
        </p>
        <p className="text-sm text-ink-muted">Edited 12 minutes ago · 14 pages</p>
        <p className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
          Recent notebooks
        </p>
      </div>
    </Section>
  )
}

const TOOL_ICONS = [
  ['Lasso', <Lasso key="l" />],
  ['Pen', <PenLine key="p" />],
  ['Highlighter', <Highlighter key="h" />],
  ['Text', <Type key="t" />],
  ['Broom', <BroomIcon key="b" />],
  ['Tables and charts', <ChartColumn key="c" />],
  ['Layers', <Layers key="y" />],
  ['Undo', <Undo2 key="u" />],
  ['Redo', <Redo2 key="r" />],
  ['Search', <Search key="s" />],
  ['New folder', <FolderPlus key="f" />],
  ['New notebook', <Plus key="n" />],
] as const

function IconsSection() {
  return (
    <Section
      title="Icons"
      note="Lucide line icons at 24 px with a 1.75 stroke. The broom is drawn on the same grid."
    >
      <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="grid size-40 place-items-center rounded-panel bg-ink text-ink-inverse shadow-raised">
          <BroomIcon size={88} strokeWidth={1.25} />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {TOOL_ICONS.map(([name, icon]) => (
            <div
              key={name}
              className="grid justify-items-center gap-2 rounded-card px-2 py-3 text-center"
            >
              <span className="[&>svg]:size-6 [&>svg]:stroke-[1.75]">{icon}</span>
              <span className="text-xs text-ink-muted">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

type Tool = 'lasso' | 'pen' | 'text' | 'broom' | 'chart'

function ToolbarSection() {
  const [tool, setTool] = useState<Tool>('pen')
  const [size, setSize] = useState(2)
  const [opacity, setOpacity] = useState(100)
  const [color, setColor] = useState('#3e2d25')
  const [broomSize, setBroomSize] = useState(12)
  const [panel, setPanel] = useState<Tool | null>(null)

  // The first tap selects a tool; tapping the selected pen or broom opens its settings.
  const selectOrOpen = (next: Tool) => (e: { preventDefault: () => void }) => {
    if (tool !== next) {
      e.preventDefault()
      setTool(next)
      setPanel(null)
    }
  }
  const panelProps = (t: Tool) => ({
    open: panel === t,
    onOpenChange: (open: boolean) => setPanel(open ? t : null),
  })

  return (
    <Section
      title="Editor toolbar"
      note="Tap a tool to select it. Tap the active pen or broom again for its settings."
    >
      <div className="grid justify-items-center gap-6 rounded-panel bg-surface-sunken px-4 py-10">
        <div
          role="toolbar"
          aria-label="Tools"
          className="flex max-w-full flex-wrap items-center justify-center gap-1 rounded-panel bg-surface-raised p-1.5 shadow-raised"
        >
          <IconButton
            label="Lasso"
            icon={<Lasso size={22} strokeWidth={1.75} />}
            active={tool === 'lasso'}
            onClick={() => {
              setTool('lasso')
              setPanel(null)
            }}
          />
          <Popover {...panelProps('pen')}>
            <PopoverTrigger asChild>
              <IconButton
                label="Pen"
                icon={<PenLine size={22} strokeWidth={1.75} />}
                active={tool === 'pen'}
                onClick={selectOrOpen('pen')}
              />
            </PopoverTrigger>
            <PopoverContent className="grid w-80 gap-5">
              <div className="flex items-center gap-3">
                <span
                  className="flex-1 rounded-full"
                  style={{ background: color, opacity: opacity / 100, height: size * 1.5 + 2 }}
                />
              </div>
              <Slider
                label="Size"
                value={size}
                min={0.5}
                max={10}
                step={0.5}
                onChange={setSize}
                format={(v) => `${v} pt`}
              />
              <Slider
                label="Opacity"
                value={opacity}
                min={10}
                max={100}
                onChange={setOpacity}
                format={(v) => `${v}%`}
              />
              <SwatchGrid value={color} onChange={setColor} />
            </PopoverContent>
          </Popover>
          <IconButton
            label="Text"
            icon={<Type size={22} strokeWidth={1.75} />}
            active={tool === 'text'}
            onClick={() => {
              setTool('text')
              setPanel(null)
            }}
          />
          <Popover {...panelProps('broom')}>
            <PopoverTrigger asChild>
              <IconButton
                label="Broom"
                icon={<BroomIcon size={22} />}
                active={tool === 'broom'}
                onClick={selectOrOpen('broom')}
              />
            </PopoverTrigger>
            <PopoverContent className="grid gap-4">
              <Slider
                label="Broom size"
                value={broomSize}
                min={4}
                max={60}
                onChange={setBroomSize}
                format={(v) => `${v} pt`}
              />
            </PopoverContent>
          </Popover>
          <IconButton
            label="Tables and charts"
            icon={<ChartColumn size={22} strokeWidth={1.75} />}
            active={tool === 'chart'}
            onClick={() => {
              setTool('chart')
              setPanel(null)
            }}
          />
          <span className="mx-1 h-7 w-px bg-line" />
          <IconButton label="Undo" icon={<Undo2 size={22} strokeWidth={1.75} />} />
          <IconButton label="Redo" icon={<Redo2 size={22} strokeWidth={1.75} />} />
        </div>
        <p className="text-sm text-ink-muted">
          Active tool: <span className="font-semibold text-ink">{tool}</span>
        </p>
      </div>
    </Section>
  )
}

function ButtonsSection() {
  return (
    <Section title="Buttons" note="Every button is at least 44 px tall for comfortable touch.">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" icon={<Plus size={18} />}>
          New notebook
        </Button>
        <Button icon={<FolderPlus size={18} />}>New folder</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="danger">Delete folder</Button>
        <Button variant="primary" disabled>
          Saving…
        </Button>
        <Button variant="primary" size="lg">
          Create notebook
        </Button>
      </div>
    </Section>
  )
}

function FieldsSection() {
  const [title, setTitle] = useState('')
  const [touched, setTouched] = useState(false)
  const error = touched && title.trim() === '' ? 'Give the notebook a title.' : undefined
  return (
    <Section title="Text fields" note="Labels sit above the field; errors explain how to fix them.">
      <div className="grid max-w-sm gap-4">
        <TextField
          label="Notebook title"
          placeholder="e.g. Biology"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => setTouched(true)}
          error={error}
        />
        <TextField label="Search" hideLabel placeholder="Search notebooks" />
      </div>
    </Section>
  )
}

function FillsSection() {
  const [fill, setFill] = useState<Fill>(GRADIENT_PRESETS[0]!.fill)
  const light = prefersLightText(fill)
  return (
    <Section
      title="Colors and gradients for folders and covers"
      note="Users choose from a large palette or ready-made gradients. Text color adapts automatically."
    >
      <div className="grid gap-8 md:grid-cols-[1fr_auto]">
        <div className="grid min-w-0 gap-5">
          <SwatchGrid
            value={fill.type === 'solid' ? fill.color : null}
            onChange={(color) => setFill({ type: 'solid', color })}
          />
          <div role="group" aria-label="Gradients" className="flex flex-wrap gap-1">
            {GRADIENT_PRESETS.map((preset) => (
              <ColorSwatch
                key={preset.name}
                size="lg"
                label={`Gradient ${preset.name}`}
                fill={preset.fill}
                selected={fill === preset.fill}
                onSelect={() => setFill(preset.fill)}
              />
            ))}
          </div>
        </div>
        <div
          className={cn(
            'flex aspect-[3/4] w-48 flex-col justify-end rounded-r-card rounded-l-md p-4 shadow-raised',
            light ? 'text-white' : 'text-ink',
          )}
          style={{ background: fillToCss(fill) }}
        >
          <p className="text-lg leading-tight font-bold">Biology</p>
          <p className={cn('text-sm', light ? 'text-white/80' : 'text-ink-muted')}>14 pages</p>
        </div>
      </div>
    </Section>
  )
}

function DialogSection() {
  const [name, setName] = useState('Biology')
  const [draft, setDraft] = useState(name)
  const [open, setOpen] = useState(false)
  return (
    <Section title="Dialog" note="Used for creating and renaming. Close with ✕, Escape or Cancel.">
      <div className="flex flex-wrap items-center gap-4">
        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (next) setDraft(name)
            setOpen(next)
          }}
        >
          <DialogTrigger asChild>
            <Button>Rename notebook</Button>
          </DialogTrigger>
          <DialogContent title="Rename notebook" description="The new name shows everywhere.">
            <form
              className="grid gap-6"
              onSubmit={(e) => {
                e.preventDefault()
                if (!draft.trim()) return
                setName(draft.trim())
                setOpen(false)
              }}
            >
              <TextField label="Title" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button variant="primary" type="submit" disabled={!draft.trim()}>
                  Save
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        <p className="text-sm text-ink-muted">
          Current name: <span className="font-semibold text-ink">{name}</span>
        </p>
      </div>
    </Section>
  )
}
