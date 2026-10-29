import { describe, expect, it } from 'vitest'
import { uniqueName } from './uniqueName.ts'

describe('uniqueName', () => {
  it('keeps a free name', () => {
    expect(uniqueName(' Mathe ', ['Physik'])).toBe('Mathe')
  })
  it('numbers a taken name, ignoring case', () => {
    expect(uniqueName('test', ['Test'])).toBe('test 2')
    expect(uniqueName('test', ['test', 'test 2'])).toBe('test 3')
    expect(uniqueName('test 2', ['test', 'test 2'])).toBe('test 3')
  })
})
