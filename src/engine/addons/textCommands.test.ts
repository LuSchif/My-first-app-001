import { describe, expect, it } from 'vitest'
import { applyTextCommand } from './textCommands.ts'

describe('text commands', () => {
  const now = new Date(2026, 10, 5, 9, 30)
  const cmds = [
    { trigger: '/todo', replacement: '☐ ', matchCase: false },
    { trigger: '/p', replacement: 'Page {page}', matchCase: true },
  ]
  it('replaces a trigger just typed, keeping the caret after the result', () => {
    expect(applyTextCommand('Buy milk /TODO', 14, cmds, 1, now)).toEqual({
      value: 'Buy milk ☐ ',
      caret: 11,
    })
    expect(applyTextCommand('see /p and more', 6, cmds, 4, now)).toEqual({
      value: 'see Page 4 and more',
      caret: 10,
    })
  })
  it('leaves other text alone', () => {
    expect(applyTextCommand('see /P', 6, cmds, 4, now)).toBeNull()
    expect(applyTextCommand('/todo later', 11, cmds, 1, now)).toBeNull()
  })
})
