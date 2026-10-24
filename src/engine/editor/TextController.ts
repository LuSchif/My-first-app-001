import { compound, setLayers, setPageObjects, type Command } from '../commands/commands.ts'
import { createLayer } from '../model/factory.ts'
import { newId } from '../model/ids.ts'
import {
  PAGE_SIZE,
  type Id,
  type LayerDef,
  type Page,
  type TextObject,
  type TextStyle,
} from '../model/types.ts'
import { FONT_STACKS, layoutText, textCenter } from '../render/text.ts'
import type { EditorContext } from './context.ts'

const DEFAULT_WIDTH = 260
const MIN_WIDTH = 60

export const DEFAULT_TEXT_STYLE: TextStyle = {
  font: 'sans',
  size: 16,
  color: '#3e2d25',
  opacity: 1,
  bold: false,
  italic: false,
  underline: false,
  align: 'left',
  lineHeight: 1.35,
}

interface Editing {
  pageId: Id
  draft: TextObject
  /** The stored object before editing, or null for a new text box. */
  original: TextObject | null
}

/**
 * Text boxes are drawn on the canvas like everything else. While one is being edited, a textarea
 * with the same font, size, rotation and position sits exactly on top of it, so typing, the
 * on-screen keyboard, autocorrect and Scribble (handwriting into text) all work natively.
 */
export class TextController {
  private readonly ctx: EditorContext
  private readonly textarea: HTMLTextAreaElement
  private editing: Editing | null = null

  constructor(ctx: EditorContext) {
    this.ctx = ctx
    const area = document.createElement('textarea')
    area.setAttribute('aria-label', 'Text')
    // No password, card or address suggestions: they add a bar above the keyboard.
    area.setAttribute('autocomplete', 'off')
    area.setAttribute('enterkeyhint', 'enter')
    area.spellcheck = true
    Object.assign(area.style, {
      position: 'absolute',
      display: 'none',
      margin: '0',
      padding: '0',
      border: '0',
      background: 'transparent',
      resize: 'none',
      overflow: 'hidden',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'break-word',
      outline: '1.5px dashed rgba(121, 90, 70, 0.8)',
      outlineOffset: '6px',
      transformOrigin: '50% 50%',
      userSelect: 'text',
      zIndex: '2',
    } satisfies Partial<CSSStyleDeclaration>)
    area.style.setProperty('-webkit-user-select', 'text')
    area.addEventListener('input', () => this.onInput())
    area.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        this.finish()
      }
    })
    ctx.host.append(area)
    this.textarea = area
  }

  get element(): HTMLTextAreaElement {
    return this.textarea
  }

  get isEditing(): boolean {
    return this.editing !== null
  }

  get style(): TextStyle | null {
    return this.editing?.draft.style ?? null
  }

  /** Starts a new text box with its first line centered on (x, y) in page coordinates. */
  create(pageId: Id, x: number, y: number, style: TextStyle): void {
    const layer = this.ctx.activeLayer()
    if (!layer || layer.locked) return
    const width = Math.max(MIN_WIDTH, Math.min(DEFAULT_WIDTH, PAGE_SIZE.width - x - 16))
    const draft: TextObject = {
      id: newId(),
      type: 'text',
      layerId: layer.id,
      x,
      y: y - (style.size * style.lineHeight) / 2,
      width,
      rotation: 0,
      text: '',
      style,
    }
    this.begin(pageId, draft, null)
  }

  edit(pageId: Id, object: TextObject): void {
    this.begin(pageId, object, object)
  }

  /** Focuses the text field again if something else took focus while it is being edited. */
  refocus(): void {
    if (this.editing && document.activeElement !== this.textarea) {
      this.textarea.focus({ preventScroll: true })
    }
  }

  setStyle(patch: Partial<TextStyle>): void {
    const e = this.editing
    if (!e) return
    e.draft = this.keepCenter(e.draft, { ...e.draft, style: { ...e.draft.style, ...patch } })
    this.position()
    this.ctx.changed()
  }

  /** Stores the text and closes the editor. An emptied text box is removed. */
  finish(): void {
    const e = this.editing
    if (!e) return
    this.editing = null
    this.textarea.style.display = 'none'
    this.textarea.blur()
    this.ctx.setHidden(new Set())

    const page = this.ctx.doc.page(e.pageId)
    if (page && !sameText(e.original, e.draft)) this.commit(page, e)
    this.ctx.requestRender()
    this.ctx.changed()
  }

  /**
   * Saves the edit as one undo step. A new text box gets a text layer of its own, right above
   * the active layer and named after the text; when a text box is emptied, its layer goes too.
   */
  private commit(page: Page, e: Editing): void {
    const empty = e.draft.text.trim() === ''
    const layers = this.ctx.doc.notebook.layers
    const commands: Command[] = []
    let draft = e.draft
    if (!e.original) {
      if (empty) return
      const active = this.ctx.activeLayer()
      const layer: LayerDef = { ...createLayer(textLayerName(draft.text)), kind: 'text' }
      const index = layers.findIndex((l) => l.id === active?.id)
      const after = [...layers]
      after.splice(index < 0 ? after.length : index + 1, 0, layer)
      commands.push(setLayers('Add text', layers, after))
      draft = { ...draft, layerId: layer.id }
      commands.push(setPageObjects('Add text', page.id, page.objects, [...page.objects, draft]))
    } else {
      const layer = layers.find((l) => l.id === draft.layerId)
      const ownLayer = layer?.kind === 'text'
      if (empty) {
        const after = page.objects.filter((o) => o.id !== draft.id)
        commands.push(setPageObjects('Delete text', page.id, page.objects, after))
        const othersOnLayer = this.ctx.doc.pageList.some((p) =>
          p.objects.some((o) => o.layerId === draft.layerId && o.id !== draft.id),
        )
        if (ownLayer && !othersOnLayer && layers.length > 1) {
          commands.push(
            setLayers(
              'Delete text',
              layers,
              layers.filter((l) => l !== layer),
            ),
          )
        }
      } else {
        const after = page.objects.map((o) => (o.id === draft.id ? draft : o))
        commands.push(setPageObjects('Edit text', page.id, page.objects, after))
        // A text layer still named after the old text follows the new text.
        if (ownLayer && layer.name === textLayerName(e.original.text)) {
          const renamed = layers.map((l) =>
            l === layer ? { ...l, name: textLayerName(draft.text) } : l,
          )
          commands.push(setLayers('Edit text', layers, renamed))
        }
      }
    }
    this.ctx.history.execute(commands.length === 1 ? commands[0]! : compound('Text', commands))
  }

  /** Moves the textarea along with the page when the camera changes. */
  position(): void {
    const e = this.editing
    if (!e) return
    const index = this.ctx.pageIndexOf(e.pageId)
    if (index < 0) {
      this.finish()
      return
    }
    const { zoom } = this.ctx.camera()
    const { draft } = e
    const { style } = draft
    const area = this.textarea
    const width = draft.width * zoom
    Object.assign(area.style, {
      width: `${width}px`,
      font: `${style.italic ? 'italic ' : ''}${style.bold ? 700 : 400} ${style.size * zoom}px ${FONT_STACKS[style.font]}`,
      lineHeight: String(style.lineHeight),
      color: style.color,
      opacity: String(style.opacity),
      textAlign: style.align,
      textDecoration: style.underline ? 'underline' : 'none',
      caretColor: style.color,
    } satisfies Partial<CSSStyleDeclaration>)
    // Height follows the text: the larger of the canvas layout and what the textarea needs.
    area.style.height = '0px'
    const height = Math.max(layoutText(draft).height * zoom, area.scrollHeight)
    area.style.height = `${height}px`
    const c = textCenter(draft)
    const center = this.ctx.toScreen(index, c.x, c.y)
    area.style.left = `${center.x - width / 2}px`
    area.style.top = `${center.y - height / 2}px`
    area.style.transform = `rotate(${draft.rotation}rad)`
  }

  private begin(pageId: Id, draft: TextObject, original: TextObject | null): void {
    this.finish()
    this.editing = { pageId, draft, original }
    this.textarea.value = draft.text
    this.textarea.style.display = 'block'
    this.ctx.setHidden(new Set([draft.id]))
    this.position()
    this.textarea.focus({ preventScroll: true })
    const end = this.textarea.value.length
    this.textarea.setSelectionRange(end, end)
    this.ctx.requestRender()
    this.ctx.changed()
    this.ensureVisible()
  }

  private onInput(): void {
    const e = this.editing
    if (!e) return
    e.draft = { ...e.draft, text: this.textarea.value }
    this.position()
    this.ensureVisible()
  }

  /**
   * Scrolls the page so the text box sits between the toolbar and the keyboard. When the box is
   * taller than that space, its end stays visible, since that is where typing happens.
   */
  ensureVisible(): void {
    if (!this.editing) return
    const area = this.ctx.visibleArea()
    const box = this.textarea.getBoundingClientRect()
    const host = this.ctx.host.getBoundingClientRect()
    const margin = 20
    const top = box.top - host.top - margin
    const bottom = box.bottom - host.top + margin
    let dy = 0
    if (bottom > area.bottom) dy = area.bottom - bottom
    if (top + dy < area.top && bottom - top <= area.bottom - area.top) dy = area.top - top
    if (Math.abs(dy) > 1) this.ctx.scrollBy(dy)
  }

  /** A style change that alters the height should not make a rotated box jump sideways. */
  private keepCenter(before: TextObject, after: TextObject): TextObject {
    if (before.rotation === 0) return after
    const a = textCenter(before)
    const b = textCenter(after)
    return { ...after, x: after.x + a.x - b.x, y: after.y + a.y - b.y }
  }
}

function sameText(a: TextObject | null, b: TextObject): boolean {
  return a !== null && a.text === b.text && JSON.stringify(a.style) === JSON.stringify(b.style)
}

/** A text layer's name: the start of its first line. */
export function textLayerName(text: string): string {
  const line = text.trim().split('\n')[0]!.trim()
  return line.length > 24 ? `${line.slice(0, 23)}…` : line || 'Text'
}
