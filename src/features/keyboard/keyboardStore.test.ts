// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  activate,
  backspace,
  close,
  cut,
  enter,
  keyboardState,
  moveCaret,
  select,
  selection,
  selectWord,
  type,
} from './keyboardStore.ts'

describe("Broomit's keyboard", () => {
  it('types into a field without focusing it, with a capital at the start', () => {
    const input = document.createElement('input')
    document.body.append(input)
    const seen: string[] = []
    input.addEventListener('input', () => seen.push(input.value))
    activate(input)
    expect(document.activeElement).not.toBe(input)
    expect(input.hasAttribute('data-virtual-focus')).toBe(true)
    type('h')
    type('i')
    expect(input.value).toBe('Hi')
    backspace()
    expect(input.value).toBe('H')
    expect(seen).toEqual(['H', 'Hi', 'H'])
    close()
    expect(input.hasAttribute('data-virtual-focus')).toBe(false)
    input.remove()
  })

  it('starts on numbers for number fields and ends a line in text areas', () => {
    const number = document.createElement('input')
    number.inputMode = 'decimal'
    document.body.append(number)
    activate(number)
    expect(keyboardState().page).toBe('numbers')
    close()
    const area = document.createElement('textarea')
    document.body.append(area)
    activate(area)
    type('a')
    enter()
    expect(area.value).toBe('A\n')
    close()
  })

  it('types and deletes at the caret, moves it by character and selects words', () => {
    const input = document.createElement('input')
    input.value = 'hello world'
    document.body.append(input)
    activate(input, 5)
    type(',', true)
    expect(input.value).toBe('hello, world')
    moveCaret(-1)
    moveCaret(-1)
    backspace()
    expect(input.value).toBe('helo, world')
    expect(selection()).toEqual({ start: 3, end: 3 })
    selectWord(8)
    expect(selection()).toEqual({ start: 6, end: 11 })
    type('there', true)
    expect(input.value).toBe('helo, there')
    select(0, 4)
    moveCaret(1)
    expect(selection()).toEqual({ start: 4, end: 4 })
    moveCaret(-1, true)
    moveCaret(-1, true)
    expect(selection()).toEqual({ start: 2, end: 4 })
    expect(cut()).toBe('lo')
    expect(input.value).toBe('he, there')
    close()
    input.remove()
  })
})
