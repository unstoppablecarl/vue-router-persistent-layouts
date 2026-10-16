import type { InjectionKey } from 'vue'
import type { LayoutPropsStore } from './store.js'
import type { Layout } from './types.js'

export interface LayoutsOptions {
  /** Layout for pages and routes that don't set one. */
  defaultLayout?: Layout
  /** Layout props store; a new one is created per app by default. */
  store?: LayoutPropsStore
  /** Register `<LayoutView>` globally. Defaults to `true`. */
  registerComponent?: boolean
}

export const LayoutsOptionsKey: InjectionKey<LayoutsOptions> = Symbol('layouts-options')
