import { flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref, Transition, type VNode } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { afterEach, describe, expect, it } from 'vitest'
import { createLayoutPropsStore, LayoutView, resetLayoutProps, setLayoutProps } from '../src/index.ts'
import { makeLayout, makePage, mountApp } from './helpers.ts'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('layout resolution', () => {
  const Default = makeLayout('Default')
  const Outer = makeLayout('Outer')
  const Inner = makeLayout('Inner', { layout: Outer })
  const Other = makeLayout('Other')

  async function render (layout: unknown, routeOptions: { meta?: object, props?: boolean } = {}, path = '/') {
    const app = await mountApp(
      [{ path: '/:id?', component: makePage('Page', { layout: layout as never }), ...routeOptions } as RouteRecordRaw],
      { path, layouts: { defaultLayout: Default } },
    )
    return app.structure()
  }

  it('uses the default layout', async () => {
    expect(await render(undefined)).toBe('Default > page:Page')
  })

  it('uses a single component', async () => {
    expect(await render(Other)).toBe('Other > page:Page')
  })

  it('follows a layout\'s own layout (extends)', async () => {
    expect(await render(Inner)).toBe('Outer > Inner > page:Page')
  })

  it('accepts a tuple with props', async () => {
    expect(await render([Other, { title: 'T' }])).toBe('Other[T] > page:Page')
  })

  it('accepts the object form', async () => {
    expect(await render({ component: Other, props: { title: 'O' } })).toBe('Other[O] > page:Page')
  })

  it('accepts an array of layouts, outermost first', async () => {
    expect(await render([Other, [Outer, { title: 'A' }]])).toBe('Other > Outer[A] > page:Page')
  })

  it('accepts named layouts', async () => {
    expect(await render({ app: Other, content: [Outer, { title: 'N' }] })).toBe('Other > Outer[N] > page:Page')
  })

  it('passes a props-only object to the default layout', async () => {
    expect(await render({ title: 'P' })).toBe('Default[P] > page:Page')
  })

  it('calls a callback with the page props', async () => {
    const layout = (props: Record<string, unknown>) => [Other, { title: `#${props.id}` }]
    expect(await render(layout, { props: true }, '/7')).toBe('Other[#7](id=7) > page:Page')
  })

  it('passes callback-returned props to the default layout', async () => {
    expect(await render(() => ({ title: 'CB' }))).toBe('Default[CB] > page:Page')
  })

  it('supports render functions', async () => {
    const layout = (render: typeof h, page: unknown) => render(Inner, { title: 'R' }, () => page)
    expect(await render(layout)).toBe('Outer > Inner[R] > page:Page')
  })

  it('falls back to route meta, inherited from parent routes', async () => {
    const app = await mountApp([
      { path: '/group', meta: { layout: [Other, { title: 'meta' }] }, children: [{ path: 'page', component: makePage('Page') }] },
    ], { path: '/group/page', layouts: { defaultLayout: Default } })
    expect(app.structure()).toBe('Other[meta] > page:Page')
  })

  it('prefers the page layout over route meta', async () => {
    expect(await render(Outer, { meta: { layout: Other } })).toBe('Outer > page:Page')
  })

  it('renders no layout for false', async () => {
    expect(await render(false)).toBe('page:Page')
  })

  it('passes page props to layouts without leaking router internals', async () => {
    expect(await render(Other, { props: true }, '/9')).toBe('Other(id=9) > page:Page')
  })
})

describe('persistence', () => {
  it('keeps shared layouts mounted across navigation', async () => {
    const Outer = makeLayout('Outer')
    const Inner = makeLayout('Inner', { layout: Outer })
    const Other = makeLayout('Other', { layout: Outer })

    const app = await mountApp([
      { path: '/a', component: makePage('A', { layout: Inner }) },
      { path: '/b', component: makePage('B', { layout: Inner }) },
      { path: '/c', component: makePage('C', { layout: Other }) },
    ], { path: '/a' })

    const outerEl = app.wrapper.element.parentElement!.querySelector('[data-layout="Outer"]')

    await app.go('/b')
    expect(app.structure()).toBe('Outer > Inner > page:B')
    expect(Inner.mounts).toBe(1)

    await app.go('/c')
    expect(app.structure()).toBe('Outer > Other > page:C')
    expect(Outer.mounts).toBe(1)
    expect(app.wrapper.element.parentElement!.querySelector('[data-layout="Outer"]')).toBe(outerEl)
  })
})

describe('setLayoutProps', () => {
  afterEach(() => resetLayoutProps())

  it('updates layouts from page setup and clears on leave', async () => {
    const Layout = makeLayout('Layout')
    const app = await mountApp([
      { path: '/a', component: makePage('A', { layout: [Layout, { title: 'static' }], setup: () => setLayoutProps({ title: 'dynamic' }) }) },
      { path: '/b', component: makePage('B', { layout: [Layout, { title: 'static' }] }) },
    ], { path: '/a' })

    expect(app.structure()).toBe('Layout[dynamic] > page:A')
    await app.go('/b')
    expect(app.structure()).toBe('Layout[static] > page:B')
  })

  it('applies targeted props over shared ones, regardless of call order', async () => {
    const Outer = makeLayout('Outer')
    const Inner = makeLayout('Inner')
    const app = await mountApp([{
      path: '/',
      component: makePage('Page', {
        layout: { outer: Outer, inner: Inner },
        setup () {
          setLayoutProps(Inner, { title: 'byComponent' })
          setLayoutProps('outer', { title: 'byName' })
          setLayoutProps({ title: 'shared' })
        },
      }),
    }])
    expect(app.structure()).toBe('Outer[byName] > Inner[byComponent] > page:Page')
  })

  it('tracks refs and getters', async () => {
    const Layout = makeLayout('Layout')
    const count = ref(1)
    const app = await mountApp([{
      path: '/',
      component: makePage('Page', { layout: Layout, setup: () => setLayoutProps(() => ({ title: `n${count.value}` })) }),
    }])
    expect(app.structure()).toBe('Layout[n1] > page:Page')
    count.value = 2
    await flushPromises()
    expect(app.structure()).toBe('Layout[n2] > page:Page')
  })

  it('works outside components (e.g. router guards) via the active store', async () => {
    const Layout = makeLayout('Layout')
    const app = await mountApp([{ path: '/', component: makePage('Page', { layout: Layout }) }])
    setLayoutProps({ title: 'guard' })
    await flushPromises()
    expect(app.structure()).toBe('Layout[guard] > page:Page')
    resetLayoutProps()
    await flushPromises()
    expect(app.structure()).toBe('Layout > page:Page')
  })

  it('isolates apps with their own store', async () => {
    const Layout = makeLayout('Layout')
    const routes = [{ path: '/', component: makePage('Page', { layout: Layout }) }]
    const store = createLayoutPropsStore()
    store.set({ title: 'isolated' })

    const a = await mountApp(routes, { layouts: { store } })
    expect(a.structure()).toBe('Layout[isolated] > page:Page')
    document.body.innerHTML = ''

    const b = await mountApp(routes)
    expect(b.structure()).toBe('Layout > page:Page')
  })
})

describe('<LayoutView> slot', () => {
  it('wraps only the page, inside the innermost layout', async () => {
    const Layout = makeLayout('Layout')
    const root = defineComponent(() => () => h(LayoutView, null, {
      default: ({ Component }: { Component: VNode }) => h('section', { 'data-layout': 'Wrapper' }, [Component]),
    }))
    const app = await mountApp([
      { path: '/a', component: makePage('A', { layout: Layout }) },
      { path: '/b', component: makePage('B', { layout: Layout }) },
    ], { path: '/a', root })

    expect(app.structure()).toBe('Layout > Wrapper > page:A')
    await app.go('/b')
    expect(app.structure()).toBe('Layout > Wrapper > page:B')
    expect(Layout.mounts).toBe(1)
  })

  it('supports <Transition> around the page', async () => {
    const Layout = makeLayout('Layout')
    const root = defineComponent(() => () => h(LayoutView, null, {
      default: ({ Component }: { Component: VNode }) => h(Transition, { name: 'fade' }, () => Component),
    }))
    const app = await mountApp([
      { path: '/a', component: makePage('A', { layout: Layout }) },
      { path: '/b', component: makePage('B', { layout: Layout }) },
    ], { path: '/a', root })

    expect(app.structure()).toBe('Layout > page:A')
    await app.go('/b')
    expect(Layout.mounts).toBe(1)
    expect(app.wrapper.element.parentElement!.querySelector('[data-page="B"]')).not.toBeNull()
  })
})
