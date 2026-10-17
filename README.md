# vue-router-persistent-layouts

Inertia-style persistent layouts for Vue Router.

Pages declare their layout, layouts can extend other layouts, and layouts stay
mounted while you navigate between pages that share them. Pages can pass props
up to their layouts with `setLayoutProps`. Layout definitions follow
[Inertia's](https://inertiajs.com/docs/v3/the-basics/layouts) format, so code
written for Inertia carries over.

## Install

```sh
pnpm add vue-router-persistent-layouts
```

```ts
import { createLayouts } from 'vue-router-persistent-layouts'
import AppLayout from './layouts/AppLayout.vue'

app
  .use(router)
  .use(createLayouts({ defaultLayout: AppLayout }))
```

Replace `<RouterView />` with `<LayoutView />`:

```vue
<template>
  <LayoutView />
</template>
```

Layouts render a `<slot />` where the page goes:

```vue
<!-- layouts/AppLayout.vue -->
<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <header>{{ title ?? 'My app' }}</header>
  <main><slot /></main>
</template>
```

## Choosing a layout

The first of these that is set wins:

1. The page's `layout` option.
2. `route.meta.layout` of the page's route, or of the closest component-less
   parent route, so you can set a layout for a whole group of routes.
3. `defaultLayout` from `createLayouts` (or the `default-layout` prop on
   `<LayoutView>`).

```vue
<script setup lang="ts">
import PostLayout from './PostLayout.vue'

defineOptions({ layout: PostLayout })
</script>
```

```ts
const routes = [
  {
    // Route group: no component, just a shared layout for its children
    path: '/posts/:id',
    meta: { layout: PostLayout },
    children: [
      { path: 'edit', component: Edit },
      { path: 'view', component: View },
    ],
  },
]
```

### Layout forms

```ts
layout: PostLayout                                       // one layout
layout: [PostLayout, { title: 'Edit' }]                  // with static props
layout: { component: PostLayout, props: { title: 'Edit' } }
layout: [AppLayout, [PostLayout, { title: 'Edit' }]]     // nested, outermost first
layout: { app: AppLayout, sidebar: SidebarLayout }       // named layouts
layout: { title: 'Edit' }                                // props for the default layout
layout: (props: LayoutProps) => [PostLayout, { title: `Post ${props.id}` }]
layout: (h: typeof import('vue').h, page: VNode) => h(PostLayout, { title: 'Edit' }, () => page)
layout: false                                            // no layout
```

As in Inertia, an arrow function with one parameter (or none) is a callback
that receives the page's props. An arrow function with exactly two parameters is
a render function. Other functions (including `function` declarations) are
treated as functional components.

A props-only object, or a callback that returns one, keeps the next layout in
line (`route.meta.layout`, then the default) and passes the props to it,
overriding its static props. With no layout to receive them, they are dropped.

`false` stops the search: `layout: false` on a page ignores the route meta and
default layout, and `meta: { layout: false }` ignores the default layout.

Layout components are rendered with `inheritAttrs: false` unless they set
`inheritAttrs: true`, because they receive every page prop and most won't be
declared.

### Extending layouts

A layout can declare its own `layout`. It is applied after the page's layouts,
starting from the outermost one:

```vue
<!-- PostLayout.vue -->
<script setup lang="ts">
import AppLayout from './AppLayout.vue'

defineOptions({ layout: AppLayout })
</script>
```

A page using `PostLayout` now renders `AppLayout > PostLayout > page`. Only the
outermost layout's `layout` is followed, so `[SidebarLayout, PostLayout]`
renders `SidebarLayout > PostLayout > page`. A layout that ends up extending
itself throws an error.

## Nested routes

A routed component can render a nested `<LayoutView>` for its child routes.
Each view applies the layouts of the records it renders, and the default layout
is applied once, by the outermost view:

```ts
const routes = [
  {
    path: '/settings',
    component: SettingsShell,          // contains <LayoutView />
    meta: { layout: AppLayout },       // wraps SettingsShell
    children: [
      // AppLayout > SettingsShell > SettingsLayout > Profile
      { path: 'profile', component: Profile, meta: { layout: SettingsLayout } },
    ],
  },
]
```

When only some views should keep a layout mounted, put it on the outermost one.

## Layout props

Layouts receive props in this order, later ones winning:

1. The page's props (route props).
2. Static props from the layout definition.
3. `setLayoutProps(props)`.
4. `setLayoutProps(target, props)`.

```ts
import { setLayoutProps } from 'vue-router-persistent-layouts'

setLayoutProps({ title: 'Edit' })                // every layout
setLayoutProps('sidebar', { collapsed: true })   // a named layout
setLayoutProps(PostLayout, { title: 'Edit' })    // a layout component, type-checked
setLayoutProps(() => ({ title: post.value.name })) // refs and getters stay reactive
```

The most recent call wins when several set the same prop.

Props set during a component's setup (including after an `await` in
`<script setup>`) are cleared when it unmounts. Under `<KeepAlive>` they only
apply while the component is active. Props set elsewhere, such as in a router
guard, an event handler or a `watch` callback, stay until `resetLayoutProps()`.
Repeated calls like these merge into the earlier ones instead of piling up.

```ts
router.beforeEach((to) => {
  setLayoutProps({ title: String(to.meta.title ?? '') })
})
```

To type named layouts:

```ts
declare module 'vue-router-persistent-layouts' {
  interface NamedLayoutProps {
    sidebar: { collapsed: boolean }
  }
}
```

## Transitions and KeepAlive

Use the default slot of `<LayoutView>` to wrap only the page. Layouts stay
outside the transition:

```vue
<LayoutView v-slot="{ Component }">
  <Transition name="fade" mode="out-in">
    <component :is="Component" />
  </Transition>
</LayoutView>
```

```vue
<LayoutView v-slot="{ Component }">
  <KeepAlive>
    <component :is="Component" />
  </KeepAlive>
</LayoutView>
```

Layouts are already kept mounted while they're shared, so `<KeepAlive>` is only
needed to cache pages.

## Stores

Each app gets its own layout props store. `setLayoutProps` uses the injected
store inside components, and the most recently installed app's store elsewhere.
To provide one yourself, for example in tests:

```ts
import { createLayoutPropsStore, LayoutPropsKey } from 'vue-router-persistent-layouts'

const store = createLayoutPropsStore()
mount(Page, { global: { provide: { [LayoutPropsKey]: store } } })
```

## Differences from Inertia

Layout definitions, the callback/render-function rules and the prop precedence
are the same as Inertia's. On top of that:

- Layouts come from the page, then `route.meta.layout`, then the default.
  Props-only layouts apply to the route meta layout if there is one.
- Layouts can extend other layouts with their own `layout` option.
- `defaultLayout` is a layout, not a `(name, page) => layout` function. Use
  `route.meta.layout` to choose layouts by route.
- `setLayoutProps` can target a layout component as well as a name, and
  accepts refs and getters.
- Dynamic props are cleared when the component that set them unmounts, not on
  every navigation. Props set outside components are not cleared on navigation;
  call `resetLayoutProps()` yourself if you need that.
- Pages are reused by Vue Router when only params change (`/posts/1` →
  `/posts/2`), so their setup doesn't run again. Use a `key` on the page, or
  getters in `setLayoutProps`, if layout props depend on params.

## API

### `createLayouts(options)`

| Option | Default | |
| --- | --- | --- |
| `defaultLayout` | none | Layout for pages and routes that don't set one. Any layout form. |
| `store` | new store | Layout props store for this app. |
| `registerComponent` | `true` | Register `<LayoutView>` globally. |

### `<LayoutView>`

Props: `name` and `route` (passed to `<RouterView>`), and `default-layout`
(overrides the plugin option; `false` disables it for this view). The default
slot receives `{ Component, route }` like `<RouterView>`'s.

### Functions

- `setLayoutProps(props)` / `setLayoutProps(target, props)`: see
  [Layout props](#layout-props).
- `resetLayoutProps()`: clears all props set with `setLayoutProps`.
- `createLayoutPropsStore()`, `useLayoutPropsStore()`: create or get a store.
- `normalizeLayouts(layout)`: flattens a layout definition into
  `{ component, props, name? }[]`, outermost first.
- `renderLayouts({ page, content, fallbacks, store })`: the rendering used by
  `<LayoutView>`, for building your own view component.

## TypeScript

Callback and render-function layouts need annotated parameters, because a
function could also be a component:

```ts
defineOptions({
  layout: (props: LayoutProps) => [PostLayout, { title: String(props.id) }],
})
```

## License

MIT. Layout definition parsing is ported from
[Inertia](https://github.com/inertiajs/inertia) (MIT).
