/**
 * Layout definition parsing, ported from Inertia so definitions behave the
 * same: @inertiajs/core src/layout.ts and @inertiajs/vue3 src/app.ts.
 * Copyright (c) Jonathan Reinink <jonathan@reinink.ca>, MIT License.
 */
import type { Component } from 'vue'
import type { LayoutCallback, LayoutProps, LayoutRenderFunction } from './types.js'

export interface LayoutDefinition {
  component: Component
  props: LayoutProps
  name?: string
}

type PlainObject = Record<string, unknown>

export function isComponent (value: unknown): value is Component {
  if (!value) return false
  if (typeof value === 'function') return true
  if (typeof value === 'object') {
    const obj = value as PlainObject
    return typeof obj.render === 'function' || typeof obj.setup === 'function'
      || typeof obj.template === 'string' || '__file' in obj || '__name' in obj
  }
  return false
}

/** `(h, page) => VNode`: arrow function with exactly two parameters */
export function isRenderFunction (value: unknown): value is LayoutRenderFunction {
  return typeof value === 'function' && value.length === 2 && value.prototype === undefined
}

/** `(pageProps) => layout`: arrow function with at most one parameter */
export function isLayoutCallback (value: unknown): value is LayoutCallback {
  return typeof value === 'function' && value.length <= 1 && value.prototype === undefined
}

function isPlainObject (value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasComponentKey (value: unknown): value is { component: unknown, props?: LayoutProps } {
  return isPlainObject(value) && 'component' in value
}

function hasComponentEntry (value: PlainObject) {
  return 'component' in value && isComponent(value.component)
}

function isNamedLayouts (value: unknown): value is PlainObject {
  if (!isPlainObject(value) || isComponent(value) || hasComponentEntry(value)) return false
  return Object.values(value).every(v =>
    isComponent(v)
    || (Array.isArray(v) && isComponent(v[0]))
    || (hasComponentKey(v) && isComponent(v.component)),
  )
}

/** A plain object that isn't a layout definition: props for the default layout */
export function isPropsObject (value: unknown): value is LayoutProps {
  return isPlainObject(value) && !isComponent(value) && !hasComponentEntry(value) && !isNamedLayouts(value)
}

export function isPropsObjectOrCallback (value: unknown): value is LayoutProps {
  if (isPropsObject(value)) return true
  if (!isPlainObject(value) || isComponent(value) || hasComponentEntry(value)) return false
  const values = Object.values(value)
  return values.length > 0 && values.every(v => typeof v === 'function')
}

function isTuple (value: unknown): value is [Component, LayoutProps] {
  return Array.isArray(value) && value.length === 2 && isComponent(value[0])
    && isPlainObject(value[1]) && !isComponent(value[1])
}

function extract (item: unknown): LayoutDefinition {
  if (Array.isArray(item) && isComponent(item[0])) {
    return { component: item[0], props: item[1] ?? {} }
  }
  if (hasComponentKey(item) && isComponent(item.component)) {
    return { component: item.component, props: item.props ?? {} }
  }
  if (isComponent(item)) {
    return { component: item, props: {} }
  }
  throw new Error(`Invalid layout definition: received ${typeof item}`)
}

/** Flattens a layout definition into outermost-first layouts. */
export function normalizeLayouts (layout: unknown): LayoutDefinition[] {
  if (!layout || isRenderFunction(layout)) return []
  if (isNamedLayouts(layout)) {
    return Object.entries(layout).map(([name, value]) => ({ ...extract(value), name }))
  }
  if (isTuple(layout)) return [{ component: layout[0], props: layout[1] ?? {} }]
  if (Array.isArray(layout)) return layout.map(extract)
  if (hasComponentKey(layout) && isComponent(layout.component)) {
    return [{ component: layout.component, props: layout.props ?? {} }]
  }
  if (isComponent(layout)) return [{ component: layout, props: {} }]
  return []
}
