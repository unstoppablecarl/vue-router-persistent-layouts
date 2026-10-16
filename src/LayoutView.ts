import type { Layout } from './types.js'
import { defineComponent, h, inject, type PropType, type SlotsType, type VNode, type VNodeArrayChildren } from 'vue'
import { type RouteLocationNormalizedLoaded, RouterView } from 'vue-router'
import { LayoutsOptionsKey } from './options.js'
import { renderLayouts } from './render.js'
import { useLayoutPropsStore } from './store.js'

/**
 * Drop-in replacement for `<RouterView>` that renders the routed page inside
 * its layouts. The layout comes from the page's `layout` option, then
 * `route.meta.layout` (inherited from parent routes), then the default layout.
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

    return () => h(RouterView, { name: props.name, route: props.route }, {
      default: ({ Component, route }: { Component?: VNode, route: RouteLocationNormalizedLoaded }) => {
        if (!Component) return slots.default?.({ Component: Component!, route })

        const content: VNode | VNodeArrayChildren = slots.default?.({ Component, route }) ?? Component
        return renderLayouts({
          page: Component,
          content,
          fallbacks: [route.meta.layout, props.defaultLayout ?? options.defaultLayout],
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
