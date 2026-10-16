import type { Plugin } from 'vue'
import { LayoutView } from './LayoutView.js'
import { type LayoutsOptions, LayoutsOptionsKey } from './options.js'
import { createLayoutPropsStore, LayoutPropsKey, setActiveLayoutPropsStore } from './store.js'

/**
 * ```ts
 * app.use(createLayouts({ defaultLayout: AppLayout }))
 * ```
 */
export function createLayouts (options: LayoutsOptions = {}): Plugin {
  return {
    install (app) {
      const store = options.store ?? createLayoutPropsStore()
      app.provide(LayoutsOptionsKey, options)
      app.provide(LayoutPropsKey, store)
      setActiveLayoutPropsStore(store)
      if (options.registerComponent !== false) {
        app.component('LayoutView', LayoutView)
      }
    },
  }
}
