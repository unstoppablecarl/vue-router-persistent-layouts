import { defineComponent, effectScope, nextTick, reactive, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createLayoutPropsStore } from '../src'

const A = defineComponent({ name: 'A', props: { title: String, b: Number }, render: () => null })
const B = defineComponent({ name: 'B', render: () => null })
const a = { component: A, props: {} }
const named = { component: B, props: {}, name: 'side' }

describe('createLayoutPropsStore', () => {
  it('applies untargeted props to every layout', () => {
    const store = createLayoutPropsStore()
    store.set({ title: 'T' })
    expect(store.get(a)).toEqual({ title: 'T' })
    expect(store.get(named)).toEqual({ title: 'T' })
  })

  it('applies targeted props only to the target, over untargeted ones', () => {
    const store = createLayoutPropsStore()
    store.set('side', { title: 'named' })
    store.set(A, { title: 'component' })
    store.set({ title: 'shared', x: 1 })
    expect(store.get(a)).toEqual({ title: 'component', x: 1 })
    expect(store.get(named)).toEqual({ title: 'named', x: 1 })
  })

  it('merges repeated unscoped calls, like Inertia', () => {
    const store = createLayoutPropsStore()
    store.set({ a: 1, b: 1 })
    store.set({ b: 2 })
    store.set('side', { c: 1 })
    store.set('side', { d: 1 })
    expect(store.get(a)).toEqual({ a: 1, b: 2 })
    expect(store.get(named)).toEqual({ a: 1, b: 2, c: 1, d: 1 })
  })

  it('keeps refs and getters reactive when merging unscoped calls', () => {
    const store = createLayoutPropsStore()
    const title = ref('one')
    store.set(() => ({ title: title.value }))
    store.set({ x: 1 })
    const state = reactive({ y: 1 })
    store.set(state)
    title.value = 'two'
    state.y = 2
    expect(store.get(a)).toEqual({ title: 'two', x: 1, y: 2 })
  })

  it('removes props set in an effect scope when it stops', () => {
    const store = createLayoutPropsStore()
    store.set({ title: 'persistent' })
    const scope = effectScope()
    scope.run(() => store.set({ title: 'scoped' }))
    expect(store.get(a)).toEqual({ title: 'scoped' })
    scope.stop()
    expect(store.get(a)).toEqual({ title: 'persistent' })
  })

  it('lets the most recent call win', () => {
    const store = createLayoutPropsStore()
    const scope = effectScope()
    scope.run(() => store.set({ title: 'scoped' }))
    store.set({ title: 'later' })
    expect(store.get(a)).toEqual({ title: 'later' })
    scope.stop()
  })

  it('resets everything', async () => {
    const store = createLayoutPropsStore()
    store.set({ a: 1 })
    effectScope().run(() => store.set(A, { b: 1 }))
    store.reset()
    await nextTick()
    expect(store.get(a)).toEqual({})
  })
})
