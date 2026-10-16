import type { Component, InjectionKey, MaybeRefOrGetter } from 'vue'
import type { LayoutDefinition } from './normalize.js'
import type { LayoutProps, NamedLayoutProps } from './types.js'
import { getCurrentScope, hasInjectionContext, inject, onScopeDispose, shallowReactive, toValue } from 'vue'

interface Entry {
  target?: string | Component
  props: MaybeRefOrGetter<LayoutProps>
}

type PropsOf<C> = C extends abstract new (...args: any) => { $props: infer P } ? P : LayoutProps

export interface LayoutPropsStore {
  /** Props for every layout. */
  set (props: MaybeRefOrGetter<LayoutProps>): void
  /** Props for a named layout. */
  set<K extends keyof NamedLayoutProps> (name: K, props: MaybeRefOrGetter<Partial<NamedLayoutProps[K]>>): void
  set (name: string, props: MaybeRefOrGetter<LayoutProps>): void
  /** Props for a layout component, type-checked against its props. */
  set<C extends Component> (layout: C, props: MaybeRefOrGetter<Partial<PropsOf<C>>>): void
  /** Dynamic props for a layout: untargeted first, then targeted, later calls winning. */
  get (definition: LayoutDefinition): LayoutProps
  /** Removes all entries. */
  reset (): void
}

/**
 * Holds props set with `setLayoutProps`. It is reactive, so layouts re-render
 * when entries or their refs/getters change. Entries set inside a component's
 * setup (or any effect scope) are removed when it is disposed.
 */
export function createLayoutPropsStore (): LayoutPropsStore {
  const entries = shallowReactive<Entry[]>([])

  function set (...args: [MaybeRefOrGetter<LayoutProps>] | [string | Component, MaybeRefOrGetter<LayoutProps>]) {
    const entry: Entry = args.length === 2
      ? { target: args[0], props: args[1] }
      : { props: args[0] }

    entries.push(entry)

    if (getCurrentScope()) {
      onScopeDispose(() => {
        const index = entries.indexOf(entry)
        if (index !== -1) entries.splice(index, 1)
      })
    }
  }

  function get ({ component, name }: LayoutDefinition): LayoutProps {
    const shared = entries.filter(e => !e.target)
    const targeted = entries.filter(e => e.target && (e.target === component || e.target === name))
    return Object.assign({}, ...[...shared, ...targeted].map(e => toValue(e.props)))
  }

  function reset () {
    entries.splice(0)
  }

  return { set, get, reset } as LayoutPropsStore
}

/** Provide a store to isolate layout props, e.g. per test. */
export const LayoutPropsKey: InjectionKey<LayoutPropsStore> = Symbol('layout-props')

const defaultStore = createLayoutPropsStore()
let activeStore: LayoutPropsStore | undefined

/** Store used outside components, e.g. in router guards. Set by `createLayouts`. */
export function setActiveLayoutPropsStore (store: LayoutPropsStore | undefined) {
  activeStore = store
}

/** The injected store, else the active one (last installed app), else a shared default. */
export function useLayoutPropsStore (): LayoutPropsStore {
  return (hasInjectionContext() && inject(LayoutPropsKey, null)) || activeStore || defaultStore
}

/**
 * Overrides layout props, like Inertia's `setLayoutProps`.
 *
 * Without a target every layout receives the props. With a layout name (from
 * named layouts) or a layout component, only that layout does, taking
 * precedence over untargeted props. Refs and getters stay reactive.
 *
 * Called during setup, the props are cleared when the component unmounts.
 * Called elsewhere (router guards, after an `await`), they stay until
 * `resetLayoutProps()`.
 */
export function setLayoutProps (props: MaybeRefOrGetter<LayoutProps>): void
export function setLayoutProps<K extends keyof NamedLayoutProps> (name: K, props: MaybeRefOrGetter<Partial<NamedLayoutProps[K]>>): void
export function setLayoutProps (name: string, props: MaybeRefOrGetter<LayoutProps>): void
export function setLayoutProps<C extends Component> (layout: C, props: MaybeRefOrGetter<Partial<PropsOf<C>>>): void
export function setLayoutProps (...args: unknown[]) {
  (useLayoutPropsStore().set as (...args: unknown[]) => void)(...args)
}

/** Clears all props set with `setLayoutProps`. */
export function resetLayoutProps () {
  useLayoutPropsStore().reset()
}
