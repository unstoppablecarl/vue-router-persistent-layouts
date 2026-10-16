import type { Component, h, VNode } from 'vue'

export type LayoutProps = Record<string, unknown>

/**
 * Props of named layouts, for type-checked `setLayoutProps(name, props)`.
 * Augment it to register names:
 *
 * ```ts
 * declare module 'vue-router-persistent-layouts' {
 *   interface NamedLayoutProps {
 *     sidebar: { collapsed: boolean }
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NamedLayoutProps {}

export type LayoutEntry =
  | Component
  | [Component, LayoutProps?]
  | { component: Component, props?: LayoutProps }

/** `{ app: AppLayout, sidebar: [Sidebar, props] }`, outermost first; targetable by name */
export type NamedLayouts = Record<string, LayoutEntry>

/**
 * Receives the page's props (at most one parameter). May return any layout
 * form, or a plain props object to pass to the default layout.
 */
export type LayoutCallback = (pageProps: LayoutProps) => LayoutEntry | LayoutEntry[] | NamedLayouts | LayoutProps | false | undefined

/** Wraps the page vnode directly (exactly two parameters). */
export type LayoutRenderFunction = (render: typeof h, page: VNode) => VNode

/**
 * Layout definition, as in Inertia:
 * - `Layout`, `[Layout, props]` or `{ component: Layout, props }`
 * - `[OuterLayout, [InnerLayout, props]]`
 * - `{ app: AppLayout, sidebar: SidebarLayout }` (named layouts)
 * - `{ title: 'Dashboard' }` (props for the default layout)
 * - `(pageProps) => any of the above`
 * - `(h, page) => h(Layout, props, () => page)`
 * - `false` for no layout
 */
export type Layout =
  | LayoutEntry
  | LayoutEntry[]
  | NamedLayouts
  | LayoutProps
  | LayoutCallback
  | LayoutRenderFunction
  | false

declare module 'vue' {
  interface ComponentCustomOptions {
    /**
     * Layout this component is rendered inside. Layouts may declare their own
     * layout to extend another one.
     */
    layout?: Layout
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    /** Layout for this route and its children, unless the page sets its own. */
    layout?: Layout
  }
}
