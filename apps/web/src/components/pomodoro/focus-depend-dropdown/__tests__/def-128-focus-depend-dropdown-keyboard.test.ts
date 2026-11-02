// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { nueUI } from '@/nue-ui-register'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'
import type { PomodoroViewContext } from '@/views/index/pomodoro/context'
import FocusDependDropdown from '../focus-depend-dropdown.vue'

/**
 * DEF-128 —— 专注依赖下拉里两处「点击型链接」键盘不可达
 *
 * @description 现状：`<nue-link @click>`（触发器「专注」）与 `<nue-link theme="depend-status-clear"
 *              @click>`（「取消关联」）均无 `route`/`href` ⇒ `nue-ui` 渲染成**无 href 的 `<a>`**
 *              ⇒ Tab 走不到、键盘 Enter 无效（与 `DEF-124` 同族）。
 *              修法沿用 `DEF-124` 先例：原生 `<button type="button">` + `class` 复用 `.nue-link`
 *              主题类（`parseTheme('depend-status-clear','nue-link')` = `nue-link--depend-status-clear`）。
 *
 * 键盘口径（与 `T608`/`DEF-124` 一致）：**jsdom 不实现原生 `<button>` 的 Enter/Space 隐式激活**，
 * 因此「键盘可达」断言为四项前提 —— 原生可激活形态（`BUTTON`）+ 可聚焦（`focus()` 命中）+
 * 可访问名 + 未被 `disabled`/`aria-disabled` 剥夺；激活行为另用 `element.click()`
 * （真实浏览器里 Enter/Space 触发的就是这个原生 click 语义）锁死。
 *
 * 挂载方式：真实组件 + 真实 `nue-*`（只替换注入上下文里的用例/订阅者等外部依赖）。
 *
 * ⚠️ **覆盖边界**：本组是**裸挂载组件**（不传 `#default` 插槽）⇒ 只覆盖**默认插槽回退路径**；
 *    真实页面 `components/pomodoro/index.vue` 会**覆写插槽**（`<template #default="{ open }">`），
 *    那条路径见页面级用例 `apps/web/src/components/pomodoro/__tests__/def-128-pomodoro-page-trigger.test.ts`
 *    （T636 复验：真实页面曾因覆写插槽仍渲染 SPAN 而缺陷未修好）。
 */

const makeContext = () => {
    const context = {
        dialogManager: { open: vi.fn(), close: vi.fn() },
        pomodoroUseCase: { loadPomodoros: vi.fn(async () => null) },
        taskUseCase: {},
        subscriber: { emit: vi.fn() },
        getProjectName: () => '',
        showTaskDetails: vi.fn(),
        isDisplayAside: ref(true),
        isUseFloatAside: ref(false),
        switchDisplayAside: vi.fn(),
        todayRecords: ref([]),
        recordLoading: ref(false),
        recordIsDone: ref(false),
        handleNextPage: vi.fn()
    }
    return context
}

let wrapper: VueWrapper | null = null

beforeEach(() => {
    setActivePinia(createPinia())
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

const mountDropdown = async (props: { presetName?: string; taskName?: string } = {}) => {
    wrapper = mount(FocusDependDropdown, {
        attachTo: document.body,
        props: { type: 1, ...props },
        global: {
            plugins: [nueUI],
            provide: {
                [POMODORO_VIEW_CONTEXT_KEY as symbol]:
                    makeContext() as unknown as PomodoroViewContext
            },
            // 任务面板不在本用例范围（默认 Tab 为常用专注，切 Tab 后列表用替身）
            stubs: { ListViewAdapter: true }
        }
    })
    await flushPromises()
    return wrapper
}

/** 按可见文本取入口（取最近的 `a` / `button`） */
const entryOf = (w: VueWrapper, label: string): HTMLElement | null => {
    const leaf = w
        .findAll('*')
        .filter((n) => (n.text() ?? '').trim() === label && n.element.children.length === 0)
        .pop()
    if (!leaf) return null
    return (leaf.element.closest('a, button') ?? leaf.element) as HTMLElement
}

const describeEntry = (el: HTMLElement | null): string =>
    el === null
        ? 'null'
        : JSON.stringify({
              tag: el.tagName,
              class: el.className,
              type: el.getAttribute('type'),
              href: el.getAttribute('href'),
              tabIndex: el.tabIndex,
              text: (el.textContent ?? '').trim()
          })

const dropdownWrapperOf = (w: VueWrapper) => w.find('.nue-dropdown-wrapper')

describe('DEF-128 · 触发入口「专注」为原生可聚焦 button', () => {
    it('① 渲染 BUTTON（非无 href 的 A），`tabIndex >= 0` 且 focus() 命中', async () => {
        const w = await mountDropdown()
        const trigger = entryOf(w, '专注')
        const detail = describeEntry(trigger)

        expect(trigger, `未找到「专注」入口：${detail}`).toBeTruthy()
        expect(trigger!.tagName, `应为原生 button：${detail}`).toBe('BUTTON')
        expect(trigger!.tagName === 'A' && !trigger!.getAttribute('href'), detail).toBe(false)
        expect(trigger!.getAttribute('type'), detail).toBe('button')
        expect(trigger!.tabIndex, detail).toBeGreaterThanOrEqual(0)
        expect((trigger!.textContent ?? '').trim(), `无可访问名：${detail}`).toBe('专注')

        trigger!.focus()
        expect(document.activeElement === trigger, `focus() 后未命中：${detail}`).toBe(true)
    })

    it('② 复用 `.nue-link` 主题类（DOM 外观零变化）且无浏览器默认按钮样式绕过', async () => {
        const w = await mountDropdown()
        const trigger = entryOf(w, '专注')!
        const detail = describeEntry(trigger)

        expect(trigger.className.split(/\s+/), detail).toContain('nue-link')
        // 类名与改前 `<nue-link>` 一致：内容仍包在 `.nue-link__content`（hover 下划线依赖它）
        expect(trigger.querySelector('.nue-link__content'), detail).toBeTruthy()
        expect(trigger.querySelector('.nue-link__content')!.textContent!.trim()).toBe('专注')
    })

    it('③ 点击仍打开下拉（行为零回归）', async () => {
        const w = await mountDropdown()
        const trigger = entryOf(w, '专注')!

        expect(dropdownWrapperOf(w).attributes('data-visible'), '初始应关闭').toBe('false')
        trigger.click()
        await flushPromises()
        expect(
            dropdownWrapperOf(w).attributes('data-visible'),
            '点击「专注」后下拉未打开（行为回归）'
        ).toBe('true')
        expect(w.find('#pomodoro-focus-depend-selector').exists(), '下拉内容应已渲染').toBe(true)
    })
})

describe('DEF-128 · 「取消关联」为原生可聚焦 button', () => {
    it('① 有已关联值时渲染 BUTTON，`tabIndex >= 0` 且 focus() 命中', async () => {
        const w = await mountDropdown({ presetName: '深度工作' })
        const clear = entryOf(w, '取消关联')
        const detail = describeEntry(clear)

        expect(clear, `未找到「取消关联」入口：${detail}`).toBeTruthy()
        expect(clear!.tagName, `应为原生 button：${detail}`).toBe('BUTTON')
        expect(clear!.getAttribute('type'), detail).toBe('button')
        expect(clear!.tabIndex, detail).toBeGreaterThanOrEqual(0)
        expect((clear!.textContent ?? '').trim(), `无可访问名：${detail}`).toBe('取消关联')

        clear!.focus()
        expect(document.activeElement === clear, `focus() 后未命中：${detail}`).toBe(true)
    })

    it('② 类名与 `theme="depend-status-clear"` 实际产生的类一致（parseTheme 口径）', async () => {
        const w = await mountDropdown({ presetName: '深度工作' })
        const clear = entryOf(w, '取消关联')!
        const classes = clear.className.split(/\s+/)

        // `parseTheme('depend-status-clear', 'nue-link')` 实测 = ['nue-link--depend-status-clear']
        // ⇒ 原生 button 必须同时带基类 `nue-link` 与主题类 `nue-link--depend-status-clear`
        expect(classes, describeEntry(clear)).toContain('nue-link')
        expect(classes, describeEntry(clear)).toContain('nue-link--depend-status-clear')
        expect(clear.querySelector('.nue-link__content')?.textContent?.trim()).toBe('取消关联')
    })

    it('③ 原生 click 语义（真实浏览器 Enter/Space 的激活路径）仍清空当前关联，且不残留无 href 的 A', async () => {
        const w = await mountDropdown({ presetName: '深度工作' })
        const clear = entryOf(w, '取消关联')!

        clear.click()
        await flushPromises()

        expect(w.emitted('selectPreset'), `实测 emit = ${JSON.stringify(w.emitted())}`).toEqual([
            [null]
        ])

        const hrefLessAnchors = w
            .findAll('a')
            .map((a) => a.element as HTMLAnchorElement)
            .filter((a) => !a.getAttribute('href'))
        expect(
            hrefLessAnchors.map((a) => a.outerHTML),
            '组件内不得再有「无 href 的 <a>」（键盘不可达）'
        ).toEqual([])
    })

    it('④ 任务 Tab 下「取消关联」等价于 clearTask', async () => {
        const w = await mountDropdown({ taskName: '写文档' })
        const taskTab = w
            .findAll('*')
            .filter(
                (n) => (n.text() ?? '').trim() === '任务专注' && n.element.children.length === 0
            )
            .pop()!
        await taskTab.trigger('click')
        await flushPromises()

        const clear = entryOf(w, '取消关联')
        expect(clear, '任务 Tab 下未找到「取消关联」').toBeTruthy()
        expect(clear!.tagName).toBe('BUTTON')

        clear!.click()
        await flushPromises()
        expect(w.emitted('clearTask'), `实测 emit = ${JSON.stringify(w.emitted())}`).toEqual([[]])
    })
})