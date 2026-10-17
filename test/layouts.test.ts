import { flushPromises } from '@vue/test-utils'
import { defineComponent, h, KeepAlive, ref, Transition, type VNode } from 'vue'
import { type RouteRecordRaw, useRoute } from 'vue-router'
import { afterEach, describe, expect, it } from 'vitest'
import { createLayoutPropsStore, LayoutView, resetLayoutProps, setLayoutProps } from '../src'
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

  it('renders no layout when a callback returns false or nothing', async () => {
    expect(await render(() => false)).toBe('page:Page')
    expect(await render(() => undefined)).toBe('page:Page')
  })

  it('renders no layout for an empty array', async () => {
    expect(await render([])).toBe('page:Page')
  })

  it('passes a props-only object to the route meta layout before the default', async () => {
    expect(await render({ title: 'P' }, { meta: { layout: Other } })).toBe('Other[P] > page:Page')
  })

  it('merges props-only objects over the default layout\'s static props', async () => {
    const app = await mountApp(
      [{ path: '/', component: makePage('Page', { layout: { title: 'page' } }) }],
      { layouts: { defaultLayout: [Default, { title: 'static', id: 'static' }] } },
    )
    expect(app.structure()).toBe('Default[page](id=static) > page:Page')
  })

  it('drops a props-only object when there is no layout to receive it', async () => {
    const app = await mountApp([{ path: '/', component: makePage('Page', { layout: { title: 'P' } }) }])
    expect(app.structure()).toBe('page:Page')
  })

  it('lets page false override route meta and the default', async () => {
    expect(await render(false, { meta: { layout: Other } })).toBe('page:Page')
  })

  it('lets route meta false override the default', async () => {
    expect(await render(undefined, { meta: { layout: false } })).toBe('page:Page')
  })

  it('accepts named layouts in object and tuple form', async () => {
    expect(await render({ a: { component: Other, props: { title: 'A' } }, b: [Outer, { title: 'B' }] }))
      .toBe('Other[A] > Outer[B] > page:Page')
  })

  it('extends from a callback result', async () => {
    expect(await render(() => [Inner, { title: 'C' }])).toBe('Outer > Inner[C] > page:Page')
  })

  it('applies only the outermost layout\'s own layout', async () => {
    expect(await render([Other, Inner])).toBe('Other > Inner > page:Page')
  })

  it('throws on layout cycles', async () => {
    const A = makeLayout('A')
    const B = makeLayout('B', { layout: A })
    ;(A as { layout?: unknown }).layout = B
    await expect(render(A)).rejects.toThrow('Layout cycle: A is its own ancestor')
  })

  it('does not apply unknown props as attributes on layouts', async () => {
    const app = await mountApp(
      [{ path: '/', component: makePage('Page', { layout: Other }), props: { foo: 'bar' } }],
    )
    expect(app.wrapper.element.parentElement!.querySelector('[data-layout="Other"]')!.hasAttribute('foo')).toBe(false)
  })

  it('uses the default-layout prop over the plugin option', async () => {
    const root = defineComponent(() => () => h(LayoutView, { defaultLayout: Other }))
    const app = await mountApp([{ path: '/', component: makePage('Page') }], { root, layouts: { defaultLayout: Default } })
    expect(app.structure()).toBe('Other > page:Page')
  })

  it('disables the default layout with :default-layout="false"', async () => {
    const root = defineComponent(() => () => h(LayoutView, { defaultLayout: false }))
    const app = await mountApp([{ path: '/', component: makePage('Page') }], { root, layouts: { defaultLayout: Default } })
    expect(app.structure()).toBe('page:Page')
  })
})

describe('nested routes', () => {
  const A = makeLayout('A')
  const B = makeLayout('B')
  const Default = makeLayout('Default')
  const Shell = defineComponent({
    name: 'Shell',
    setup: () => () => h('div', { 'data-layout': 'Shell' }, [h(LayoutView)]),
  })

  it('uses the closest component-less parent\'s meta', async () => {
    const app = await mountApp([{
      path: '/a',
      meta: { layout: A },
      children: [{ path: 'b', meta: { layout: B }, children: [{ path: 'c', component: makePage('C') }] }],
    }], { path: '/a/b/c' })
    expect(app.structure()).toBe('B > page:C')
  })

  it('does not wrap a parent component in its child route\'s layout', async () => {
    const app = await mountApp([{
      path: '/s',
      component: Shell,
      meta: { layout: A },
      children: [{ path: 'x', component: makePage('X'), meta: { layout: B } }],
    }], { path: '/s/x' })
    expect(app.structure()).toBe('A > Shell > B > page:X')
  })

  it('applies the default layout only in the outermost view', async () => {
    const app = await mountApp([{
      path: '/s',
      component: Shell,
      children: [
        { path: 'x', component: makePage('X') },
        { path: 'y', component: makePage('Y', { layout: B }) },
      ],
    }], { path: '/s/x', layouts: { defaultLayout: Default } })
    expect(app.structure()).toBe('Default > Shell > page:X')
    await app.go('/s/y')
    expect(app.structure()).toBe('Default > Shell > B > page:Y')
    expect(Default.mounts).toBe(1)
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

  it('updates static props without remounting', async () => {
    const Layout = makeLayout('Layout')
    const app = await mountApp([
      { path: '/a', component: makePage('A', { layout: [Layout, { title: 'A' }] }) },
      { path: '/b', component: makePage('B', { layout: { component: Layout, props: { title: 'B' } } }) },
    ], { path: '/a' })
    await app.go('/b')
    expect(app.structure()).toBe('Layout[B] > page:B')
    expect(Layout.mounts).toBe(1)
  })

  it('persists a layout whether it comes from the page, route meta or the default', async () => {
    const Layout = makeLayout('Layout')
    const app = await mountApp([
      { path: '/a', component: makePage('A', { layout: Layout }) },
      { path: '/b', component: makePage('B'), meta: { layout: Layout } },
      { path: '/c', component: makePage('C') },
    ], { path: '/a', layouts: { defaultLayout: Layout } })
    await app.go('/b')
    await app.go('/c')
    expect(app.structure()).toBe('Layout > page:C')
    expect(Layout.mounts).toBe(1)
  })

  it('remounts a layout after visiting a page without it', async () => {
    const Layout = makeLayout('Layout')
    const app = await mountApp([
      { path: '/a', component: makePage('A', { layout: Layout }) },
      { path: '/b', component: makePage('B', { layout: false }) },
    ], { path: '/a' })
    await app.go('/b')
    expect(app.structure()).toBe('page:B')
    await app.go('/a')
    expect(Layout.mounts).toBe(2)
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

  it('stops reading a page\'s getters once navigation leaves it', async () => {
    const Layout = makeLayout('Layout')
    const posts: Record<string, { title: string }> = { 1: { title: 'Post 1' } }
    const app = await mountApp([
      {
        path: '/posts/:id',
        component: makePage('Post', {
          layout: Layout,
          setup () {
            const route = useRoute()
            setLayoutProps(() => ({ title: posts[route.params.id as string]!.title }))
          },
        }),
      },
      { path: '/b', component: makePage('B', { layout: Layout }) },
    ], { path: '/posts/1' })

    expect(app.structure()).toBe('Layout[Post 1] > page:Post')
    await app.go('/b')
    expect(app.structure()).toBe('Layout > page:B')
  })

  it('stops reading a page\'s targeted getters for named layouts once navigation leaves it', async () => {
    const Outer = makeLayout('Outer')
    const Inner = makeLayout('Inner')
    const posts: Record<string, { title: string }> = { 1: { title: 'Post 1' } }
    const layout = { outer: Outer, inner: Inner }
    const app = await mountApp([
      {
        path: '/posts/:id',
        component: makePage('Post', {
          layout,
          setup () {
            const route = useRoute()
            setLayoutProps('inner', () => ({ title: posts[route.params.id as string]!.title }))
            setLayoutProps(Outer, () => ({ id: route.params.id as string }))
          },
        }),
      },
      { path: '/b', component: makePage('B', { layout }) },
    ], { path: '/posts/1' })

    expect(app.structure()).toBe('Outer(id=1) > Inner[Post 1] > page:Post')
    await app.go('/b')
    expect(app.structure()).toBe('Outer > Inner > page:B')
  })

  it('keeps a reused page\'s props when only params change', async () => {
    const Layout = makeLayout('Layout')
    const app = await mountApp([{
      path: '/posts/:id',
      component: makePage('Post', {
        layout: Layout,
        setup () {
          const route = useRoute()
          setLayoutProps(() => ({ title: `post ${route.params.id}` }))
        },
      }),
    }], { path: '/posts/1' })

    expect(app.structure()).toBe('Layout[post 1] > page:Post')
    await app.go('/posts/2')
    expect(app.structure()).toBe('Layout[post 2] > page:Post')
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

  it('applies props in order: page < static < shared < targeted', async () => {
    const Layout = makeLayout('Layout')
    const page = (setup?: () => void) => makePage('Page', { layout: [Layout, { title: 'static', id: 'static' }], setup })

    let app = await mountApp([{ path: '/', component: page(), props: { title: 'page', id: 'page' } }])
    expect(app.structure()).toBe('Layout[static](id=static) > page:Page')
    document.body.innerHTML = ''

    app = await mountApp([{
      path: '/',
      component: page(() => {
        setLayoutProps(Layout, { title: 'targeted' })
        setLayoutProps({ title: 'shared', id: 'shared' })
      }),
    }])
    expect(app.structure()).toBe('Layout[targeted](id=shared) > page:Page')
  })

  it('only applies named props to the named layout', async () => {
    const Outer = makeLayout('Outer')
    const Inner = makeLayout('Inner')
    const app = await mountApp([{
      path: '/',
      component: makePage('Page', { layout: { outer: Outer, inner: Inner }, setup: () => setLayoutProps('inner', { title: 'x' }) }),
    }])
    expect(app.structure()).toBe('Outer > Inner[x] > page:Page')
  })

  it('applies only the active page\'s props under <KeepAlive>', async () => {
    const Layout = makeLayout('Layout')
    const root = defineComponent(() => () => h(LayoutView, null, {
      default: ({ Component }: { Component: VNode }) => h(KeepAlive, null, [Component]),
    }))
    const app = await mountApp([
      { path: '/a', component: makePage('A', { layout: Layout, setup: () => setLayoutProps({ title: 'a' }) }) },
      { path: '/b', component: makePage('B', { layout: Layout, setup: () => setLayoutProps({ title: 'b' }) }) },
      { path: '/c', component: makePage('C', { layout: Layout }) },
    ], { path: '/a', root })

    await app.go('/b')
    expect(app.structure()).toBe('Layout[b] > page:B')
    await app.go('/a')
    expect(app.structure()).toBe('Layout[a] > page:A')
    await app.go('/c')
    expect(app.structure()).toBe('Layout > page:C')
  })

  it('lets a persistent layout set props for another layout', async () => {
    const Layout = makeLayout('Layout')
    const Shell = defineComponent({
      name: 'Shell',
      setup (_props, { slots }) {
        setLayoutProps(Layout, { title: 'from shell' })
        return () => h('div', { 'data-layout': 'Shell' }, slots.default?.())
      },
    })
    const app = await mountApp([
      { path: '/a', component: makePage('A', { layout: [Layout, Shell] }) },
      { path: '/b', component: makePage('B', { layout: [Layout, Shell] }) },
    ], { path: '/a' })
    expect(app.structure()).toBe('Layout[from shell] > Shell > page:A')
    await app.go('/b')
    expect(app.structure()).toBe('Layout[from shell] > Shell > page:B')
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
