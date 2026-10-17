import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { normalizeLayouts } from '../src'
import { isLayoutCallback, isPropsObject, isPropsObjectOrCallback, isRenderFunction } from '../src/normalize.ts'

const A = defineComponent({ name: 'A', render: () => null })
const B = defineComponent({ name: 'B', setup: () => () => null })

describe('normalizeLayouts', () => {
  it('returns nothing for empty values', () => {
    expect(normalizeLayouts(undefined)).toEqual([])
    expect(normalizeLayouts(false)).toEqual([])
    expect(normalizeLayouts([])).toEqual([])
  })

  it('handles a component', () => {
    expect(normalizeLayouts(A)).toEqual([{ component: A, props: {} }])
  })

  it('treats [Component, props] as one layout with props', () => {
    expect(normalizeLayouts([A, { title: 'T' }])).toEqual([{ component: A, props: { title: 'T' } }])
  })

  it('treats [Component, Component] as two layouts', () => {
    expect(normalizeLayouts([A, B])).toEqual([{ component: A, props: {} }, { component: B, props: {} }])
  })

  it('handles the object form', () => {
    expect(normalizeLayouts({ component: A, props: { x: 1 } })).toEqual([{ component: A, props: { x: 1 } }])
    expect(normalizeLayouts({ component: A })).toEqual([{ component: A, props: {} }])
  })

  it('handles mixed arrays', () => {
    expect(normalizeLayouts([A, [B, { x: 1 }], { component: A, props: { y: 2 } }])).toEqual([
      { component: A, props: {} },
      { component: B, props: { x: 1 } },
      { component: A, props: { y: 2 } },
    ])
  })

  it('names named layouts', () => {
    expect(normalizeLayouts({ app: A, side: [B, { x: 1 }], foot: { component: A } })).toEqual([
      { component: A, props: {}, name: 'app' },
      { component: B, props: { x: 1 }, name: 'side' },
      { component: A, props: {}, name: 'foot' },
    ])
  })

  it('ignores render functions and props objects', () => {
    expect(normalizeLayouts((_h: typeof h, page: unknown) => page)).toEqual([])
    expect(normalizeLayouts({ title: 'T' })).toEqual([])
  })

  it('recognizes SFC-like objects as components', () => {
    const sfc = { __name: 'Sfc' }
    expect(normalizeLayouts(sfc)).toEqual([{ component: sfc, props: {} }])
  })

  it('throws on invalid array items', () => {
    expect(() => normalizeLayouts([A, 'nope', B])).toThrow('Invalid layout definition: received string')
  })
})

describe('function detection (same rules as Inertia)', () => {
  it('arrow functions with two parameters are render functions', () => {
    expect(isRenderFunction((_h: unknown, _page: unknown) => null)).toBe(true)
    expect(isLayoutCallback((_h: unknown, _page: unknown) => null)).toBe(false)
  })

  it('arrow functions with zero or one parameter are callbacks', () => {
    expect(isLayoutCallback(() => A)).toBe(true)
    expect(isLayoutCallback((_props: unknown) => A)).toBe(true)
    expect(isRenderFunction(() => A)).toBe(false)
  })

  it('regular functions are components', () => {
    expect(isLayoutCallback(function Functional () { return null })).toBe(false)
    expect(isRenderFunction(function Functional (_p: unknown, _c: unknown) { return null })).toBe(false)
  })
})

describe('props objects', () => {
  it('distinguishes props from layout definitions', () => {
    expect(isPropsObject({ title: 'T' })).toBe(true)
    // As in Inertia, {} is an empty set of named layouts, not props
    expect(isPropsObject({})).toBe(false)
    expect(isPropsObject(A)).toBe(false)
    expect(isPropsObject({ component: A })).toBe(false)
    expect(isPropsObject({ app: A })).toBe(false)
    expect(isPropsObject([A])).toBe(false)
  })

  it('treats objects of only functions as props', () => {
    expect(isPropsObjectOrCallback({ onClose: () => {} })).toBe(true)
    expect(isPropsObjectOrCallback({ component: A })).toBe(false)
  })
})
