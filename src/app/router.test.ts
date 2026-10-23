import { describe, expect, it } from 'vitest'
import { parseRoute, routeToHash } from './router.ts'

describe('routes', () => {
  it('round-trips notebook routes', () => {
    const route = { name: 'notebook', id: '0b5c2c1e-1d7a-4b55-9f0e-3a3c7f0d2b11' } as const
    expect(parseRoute(routeToHash(route))).toEqual(route)
  })

  it('falls back to the library', () => {
    expect(parseRoute('')).toEqual({ name: 'library' })
    expect(parseRoute('#/something/else')).toEqual({ name: 'library' })
  })
})
