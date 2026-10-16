import type { Layout, LayoutsOptions } from '../src/index.ts'
import { flushPromises, mount } from '@vue/test-utils'
import { type Component, defineComponent, h, onMounted, type SetupContext } from 'vue'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { createLayouts, LayoutView } from '../src/index.ts'

export type TestLayout = Component & { mounts: number }

/** Layout that renders `name[title]` around its slot and counts mounts. */
export function makeLayout (name: string, options: { layout?: Layout } = {}): TestLayout {
  const component = defineComponent({
    name,
    __name: name,
    props: { title: String, id: String },
    layout: options.layout,
    setup (props: { title?: string, id?: string }, { slots }: SetupContext) {
      onMounted(() => component.mounts++)
      return () => h('div', { 'data-layout': name, 'data-title': props.title ?? '', 'data-id': props.id ?? '' }, slots.default?.())
    },
  } as any) as unknown as TestLayout
  component.mounts = 0
  return component
}

export function makePage (name: string, options: { layout?: Layout, setup?: () => void } = {}): Component {
  return defineComponent({
    name,
    props: { id: String },
    layout: options.layout,
    setup () {
      options.setup?.()
      return () => h('p', { 'data-page': name }, name)
    },
  } as any)
}

/** Nested structure, e.g. `Outer[x] > Inner > page:Home`. */
export function structure (root: Element): string {
  const parts: string[] = []
  let el: Element | null = root.querySelector('[data-layout], [data-page]')
  while (el) {
    if (el.hasAttribute('data-page')) {
      parts.push(`page:${el.getAttribute('data-page')}`)
      break
    }
    const title = el.getAttribute('data-title')
    const id = el.getAttribute('data-id')
    parts.push(el.getAttribute('data-layout')! + (title ? `[${title}]` : '') + (id ? `(id=${id})` : ''))
    el = el.querySelector(':scope > [data-layout], :scope > [data-page], :scope > * > [data-layout], :scope > * > [data-page]')
  }
  return parts.join(' > ')
}

export async function mountApp (
  routes: RouteRecordRaw[],
  options: { path?: string, layouts?: LayoutsOptions, root?: Component } = {},
) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(options.path ?? '/')
  await router.isReady()

  const wrapper = mount(options.root ?? defineComponent(() => () => h(LayoutView)), {
    global: { plugins: [router, createLayouts(options.layouts)] },
    attachTo: document.body,
  })
  await flushPromises()

  return {
    router,
    wrapper,
    structure: () => structure(wrapper.element.parentElement!),
    async go (path: string) {
      await router.push(path)
      await flushPromises()
    },
  }
}
