// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { activate, backspace, close, enter, keyboardState, type } from './keyboardStore.ts'

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
})
