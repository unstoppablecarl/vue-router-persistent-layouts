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

Layouts render a `<slot />` where the page goes.

## Choosing a layout

The first of these that is set wins:

1. The page's `layout` option.
2. `route.meta.layout`. Vue Router merges `meta` from parent routes, so you can
   set a layout for a whole group of routes.
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

As in Inertia, a function with one parameter (or none) is a callback that
receives the page's props. A function with exactly two parameters is a render
function. Other functions are treated as components.

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

A page using `PostLayout` now renders `AppLayout > PostLayout > page`.

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

Props set during a component's setup are cleared when it unmounts. Props set
elsewhere, such as in a router guard or after an `await` in setup, stay until
`resetLayoutProps()`.

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

- Layouts come from the page, then `route.meta.layout`, then the default.
- Layouts can extend other layouts with their own `layout` option.
- `setLayoutProps` can target a layout component as well as a name, and
  accepts refs and getters.
- Dynamic props are cleared when the component that set them unmounts, not on
  every navigation.

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
