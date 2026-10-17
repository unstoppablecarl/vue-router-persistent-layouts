import type { LayoutPropsStore } from './store.js'
import type { Layout, LayoutProps } from './types.js'
import { Fragment, h, type VNode, type VNodeArrayChildren } from 'vue'
import { isLayoutCallback, isPropsObject, isPropsObjectOrCallback, isRenderFunction, normalizeLayouts } from './normalize.js'

interface WithLayout {
  layout?: Layout
  inheritAttrs?: boolean
  name?: string
  __name?: string
}

interface Context {
  pageProps: LayoutProps
  store: LayoutPropsStore
  /** Layouts whose own `layout` was applied, to catch cycles. */
  extended: Set<unknown>
}

/**
 * Wraps `child` in `layout`. When there is no layout, or only props for the
 * default one, the next fallback is used. Afterwards the outermost layout's
 * own `layout` option is applied, so layouts can extend each other.
 */
function wrap (
  child: VNode,
  layout: Layout | undefined | null,
  context: Context,
  fallbacks: (Layout | undefined)[] = [],
  extraProps: LayoutProps = {},
): VNode {
  if (layout === undefined || layout === null) {
    const [next, ...rest] = fallbacks
    return fallbacks.length > 0 ? wrap(child, next, context, rest, extraProps) : child
  }

  if (isRenderFunction(layout)) {
    return extend(layout(h, child), context)
  }

  if (isLayoutCallback(layout)) {
    const result = layout(context.pageProps)
    return isPropsObjectOrCallback(result)
      ? wrap(child, undefined, context, fallbacks, { ...extraProps, ...result })
      : wrap(child, result ?? false, context, [], extraProps)
  }

  if (isPropsObject(layout)) {
    return wrap(child, undefined, context, fallbacks, { ...extraProps, ...layout })
  }

  const layouts = normalizeLayouts(layout)
  if (layouts.length === 0) return child

  const wrapped = layouts.reduceRight<VNode>((inner, definition) => {
    const component = definition.component as WithLayout
    // Layouts receive page and shared props, so don't leak unknown ones as attrs
    component.inheritAttrs = !!component.inheritAttrs
    return h(definition.component, {
      ...context.pageProps,
      ...definition.props,
      ...extraProps,
      ...context.store.get(definition),
    }, () => inner)
  }, child)

  return extend(wrapped, context)
}

/** Applies the layout declared by `vnode`'s component, if any. */
function extend (vnode: VNode, context: Context): VNode {
  const type = vnode.type as WithLayout
  if (type.layout === undefined) return vnode
  if (context.extended.has(type)) {
    throw new Error(`Layout cycle: ${type.name ?? type.__name ?? 'a layout'} is its own ancestor`)
  }
  context.extended.add(type)
  return wrap(vnode, type.layout, context)
}

/** Page props minus vnode internals RouterView adds (ref, hooks). */
function getPageProps (page: VNode): LayoutProps {
  const props: LayoutProps = {}
  for (const [key, value] of Object.entries(page.props ?? {})) {
    if (key !== 'ref' && key !== 'key' && !key.startsWith('onVnode')) props[key] = value
  }
  return props
}

function toVNode (content: VNode | VNodeArrayChildren): VNode {
  if (!Array.isArray(content)) return content
  return content.length === 1 && content[0] && typeof content[0] === 'object' && !Array.isArray(content[0])
    ? content[0] as VNode
    : h(Fragment, null, content)
}

export interface RenderLayoutsOptions {
  /** The routed page; its `layout` option is used. */
  page: VNode
  /** What to render inside the innermost layout. Defaults to `page`. */
  content?: VNode | VNodeArrayChildren
  /** Used when the page doesn't set a layout, in order. */
  fallbacks?: (Layout | undefined)[]
  store: LayoutPropsStore
}

/**
 * Renders a page inside its layouts. Layout props merge as in Inertia:
 * page props < static props < setLayoutProps() < setLayoutProps(target).
 */
export function renderLayouts ({ page, content = page, fallbacks = [], store }: RenderLayoutsOptions): VNode {
  return wrap(
    toVNode(content),
    (page.type as WithLayout).layout,
    { pageProps: getPageProps(page), store, extended: new Set() },
    fallbacks,
  )
}
