import type { Layout } from './types.js'
import {
  defineComponent,
  h,
  inject,
  type InjectionKey,
  type PropType,
  provide,
  type SlotsType,
  unref,
  type VNode,
  type VNodeArrayChildren,
} from 'vue'
import { type RouteLocationNormalizedLoaded, RouterView, viewDepthKey } from 'vue-router'
import { LayoutsOptionsKey } from './options.js'
import { renderLayouts } from './render.js'
import { useLayoutPropsStore } from './store.js'

const NestedLayoutViewKey: InjectionKey<true> = Symbol('nested-layout-view')

/**
 * `meta.layout` of the records this view renders: the matched record at
 * `depth` plus the component-less records RouterView skips to reach it. The
 * closest one wins. Records rendered by outer or inner views are ignored.
 */
function getMetaLayout (route: RouteLocationNormalizedLoaded, depth: number): Layout | undefined {
  let layout: Layout | undefined
  for (let i = depth; i < route.matched.length; i++) {
    const record = route.matched[i]!
    if (record.meta.layout !== undefined) layout = record.meta.layout
    if (record.components) break
  }
  return layout
}

/**
 * Drop-in replacement for `<RouterView>` that renders the routed page inside
 * its layouts. The layout comes from the page's `layout` option, then
 * `route.meta.layout` (including component-less parent routes), then the
 * default layout.
 *
 * Layouts persist between pages that share them. Use the default slot to wrap
 * only the page, e.g. in `<Transition>` or `<KeepAlive>`:
 *
 * ```vue
 * <LayoutView v-slot="{ Component }">
 *   <Transition name="fade" mode="out-in">
 *     <component :is="Component" />
 *   </Transition>
 * </LayoutView>
 * ```
 *
 * A `<LayoutView>` nested inside a routed component only applies the child
 * page's own layout and its route's `meta.layout`; the default layout is
 * applied once, by the outermost view.
 */
export const LayoutView = defineComponent({
  name: 'LayoutView',
  props: {
    /** Overrides the `defaultLayout` passed to `createLayouts`. */
    defaultLayout: {
      type: [Object, Function, Array, Boolean] as PropType<Layout>,
      default: undefined,
    },
    /** Passed to `<RouterView>`. */
    name: String,
    /** Passed to `<RouterView>`. */
    route: Object as PropType<RouteLocationNormalizedLoaded>,
  },
  slots: Object as SlotsType<{
    default: { Component: VNode, route: RouteLocationNormalizedLoaded }
  }>,
  setup (props, { slots }) {
    const options = inject(LayoutsOptionsKey, {})
    const store = useLayoutPropsStore()
    const depth = inject(viewDepthKey, 0)
    const nested = inject(NestedLayoutViewKey, false)
    provide(NestedLayoutViewKey, true)

    return () => h(RouterView, { name: props.name, route: props.route }, {
      default: ({ Component, route }: { Component?: VNode, route: RouteLocationNormalizedLoaded }) => {
        if (!Component) return slots.default?.({ Component: Component!, route })

        const content: VNode | VNodeArrayChildren = slots.default?.({ Component, route }) ?? Component
        return renderLayouts({
          page: Component,
          content,
          fallbacks: [
            getMetaLayout(route, unref(depth)),
            props.defaultLayout ?? (nested ? undefined : options.defaultLayout),
          ],
          store,
        })
      },
    })
  },
})

declare module 'vue' {
  interface GlobalComponents {
    LayoutView: typeof LayoutView
  }
}
