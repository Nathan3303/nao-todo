// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { useSubscriber } from '@nao-todo/shared/hooks'
import { usePomodoroSessionStore } from '@nao-todo/presentation/pomodoro'
import { nueUI } from '@/nue-ui-register'
import { useCaseBinding } from '@/hooks/usecases/binding'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'
import type { PomodoroViewContext } from '@/views/index/pomodoro/context'
import PomodoroPage from '../index.vue'

/**
 * DEF-128 · **页面级**用例：「专注」触发入口在真实页面必须键盘可达
 *
 * @description 缺陷成因（T636 复验）：组件默认插槽已改成原生 `button`，但**唯一调用点**
 *              `components/pomodoro/index.vue` 用 `<template #default="{ open }">` 覆写插槽，
 *              里面仍是 `<nue-text>`（渲染成 `SPAN`，`tabIndex=-1`、无 role）⇒ Tab 停不到、Enter 无效。
 *              ⇒ 页面级用例是防「同类漏测复发」的主闸门：**真挂载页面**（真 Pinia + memory router +
 *              真 `nue-*`，只 stub 计时器/笔记/轮次/头部等重子件，**不 stub 下拉组件本身**）。
 *
 * 键盘口径（与 `T608`/`DEF-124`/`DEF-128` 组件级用例一致）：jsdom 不实现原生 `<button>` 的
 * Enter/Space 隐式激活，因此「键盘可达」断言为四项前提 —— 原生可激活形态（`BUTTON[type=button]`）
 * + 可聚焦（`focus()` 命中 `document.activeElement`）+ 可访问名非空 + 未被 `disabled` 剥夺；
 * 激活行为另用 `element.click()`（真实浏览器里 Enter/Space 触发的就是这个原生 click 语义）。
 */

const routes: RouteRecordRaw[] = [
    {
        path: '/pomodoro/:type/:taskId?',
        name: 'pomodoro',
        component: { template: '<div />' }
    }
]

const makeContext = () =>
    ({
        dialogManager: { open: vi.fn(), close: vi.fn() },
        pomodoroUseCase: { loadPomodoros: vi.fn(async () => null) },
        taskUseCase: {},
        subscriber: useSubscriber(),
        getProjectName: () => '',
        showTaskDetails: vi.fn(),
        isDisplayAside: { value: true },
        isUseFloatAside: { value: false },
        switchDisplayAside: vi.fn(),
        todayRecords: { value: [] },
        recordLoading: { value: false },
        recordIsDone: { value: false },
        handleNextPage: vi.fn()
    }) as unknown as PomodoroViewContext

let wrapper: VueWrapper | null = null

beforeEach(() => {
    setActivePinia(createPinia())
    // 页面 composable 在 setup 期构造记录用例 ⇒ 仓储注入用伪实现（jsdom 无 IndexedDB）
    vi.spyOn(useCaseBinding, 'createPomodoroRecordRepository').mockReturnValue({
        get: async () => [null, null],
        create: async () => [null, null],
        list: async () => [
            { entities: [], pagination: { total: 0, page: 1, limit: 20, maxPage: 1 } },
            null
        ]
    } as never)
    vi.spyOn(useCaseBinding, 'createPomodoroRepository').mockReturnValue({
        get: async () => [null, null],
        list: async () => [
            { pomodoroEntities: [], pagination: { total: 0, page: 1, limit: 20, maxPage: 1 } },
            null
        ]
    } as never)
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

const mountPage = async (): Promise<VueWrapper> => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/pomodoro/timer')
    await router.isReady()

    wrapper = mount(PomodoroPage, {
        attachTo: document.body,
        global: {
            plugins: [router, nueUI],
            // 重子件用替身；下拉组件（被测入口所在）保持真实
            stubs: {
                PomodoroHeader: true,
                PomodoroTimerComp: true,
                PomodoroFocusComp: true,
                PomodoroNotesComp: true,
                PomodoroRoundsIndicator: true,
                ListViewAdapter: true
            },
            provide: { [POMODORO_VIEW_CONTEXT_KEY as symbol]: makeContext() }
        }
    })
    await flushPromises()
    // 造「已关联常用专注」态：文案变为「< 深度工作 >」（非空可访问名 + 「取消关联」入口出现）
    usePomodoroSessionStore().selectPomodoro('p1', '深度工作')
    await flushPromises()
    return wrapper
}

/** 页面上的「专注」触发入口（唯一带 `task-select-trigger` 主题类的元素） */
const triggerOf = (w: VueWrapper) => w.find('.nue-text--task-select-trigger')

const describeEl = (el: Element | undefined): string =>
    el === undefined
        ? 'null'
        : JSON.stringify({
              tag: el.tagName,
              class: el.className,
              type: el.getAttribute('type'),
              tabIndex: (el as HTMLElement).tabIndex,
              role: el.getAttribute('role'),
              text: (el.textContent ?? '').trim()
          })

describe('DEF-128 · 页面级：「专注」触发入口为原生可聚焦 button', () => {
    it('① 真实页面渲染 BUTTON[type=button]（不是 SPAN / 无 href 的 A），tabIndex >= 0', async () => {
        const w = await mountPage()
        // 反断言先行（L5）：被测入口所在的组件必须是**真实**组件（防今后误 stub 掉而“测了个假页面”）。
        // 必须先于 `.element` 取值 —— 一旦被误 stub，`.element` 会先抛
        // `Cannot call element on an empty DOMWrapper`，掩盖真实原因（L5）。
        expect(
            w.findComponent({ name: 'PomodoroFocusDependDropdown' }).exists(),
            'PomodoroFocusDependDropdown 不得被 stub'
        ).toBe(true)
        const trigger = triggerOf(w).element
        const detail = describeEl(trigger)

        expect(trigger, `页面上未找到触发入口：${detail}`).toBeTruthy()
        expect(trigger.tagName, `应为原生 button：${detail}`).toBe('BUTTON')
        expect(trigger.getAttribute('type'), detail).toBe('button')
        expect((trigger as HTMLElement).tabIndex, detail).toBeGreaterThanOrEqual(0)
        expect(trigger.getAttribute('role'), detail).toBe(null)
        expect(trigger.getAttribute('aria-disabled'), detail).toBe(null)
        expect((trigger as HTMLElement).hasAttribute('disabled'), detail).toBe(false)
    })

    it('② 可访问名非空（可见文案），`focus()` 后 document.activeElement 命中', async () => {
        const w = await mountPage()
        const trigger = triggerOf(w).element as HTMLElement
        const detail = describeEl(trigger)

        expect((trigger.textContent ?? '').trim(), `可访问名为空：${detail}`).toBe('< 深度工作 >')

        trigger.focus()
        expect(document.activeElement === trigger, `focus() 后未命中：${detail}`).toBe(true)
    })

    it('③ 原生 click 语义（真实浏览器 Enter/Space 的激活路径）打开下拉', async () => {
        const w = await mountPage()
        const trigger = triggerOf(w).element as HTMLElement
        const dropdownWrapper = w.find('.nue-dropdown-wrapper')

        expect(dropdownWrapper.attributes('data-visible'), '初始应关闭').toBe('false')
        trigger.click()
        await flushPromises()

        expect(
            dropdownWrapper.attributes('data-visible'),
            '点击「专注」后下拉未打开（行为回归）'
        ).toBe('true')
        expect(w.find('#pomodoro-focus-depend-selector').exists(), '下拉内容应已渲染').toBe(true)
    })

    it('④ 页面内不再存在「不可聚焦的触发入口」（SPAN / 无 href 的 A）', async () => {
        const w = await mountPage()
        const spanTriggers = w
            .findAll('.nue-text--task-select-trigger')
            .map((n) => n.element)
            .filter((el) => el.tagName !== 'BUTTON')
        const hrefLessAnchors = w
            .findAll('a')
            .map((n) => n.element as HTMLAnchorElement)
            .filter((a) => !a.getAttribute('href'))

        expect(
            spanTriggers.map((el) => describeEl(el)),
            '触发入口不得是 SPAN 等不可聚焦元素'
        ).toEqual([])
        expect(
            hrefLessAnchors.map((a) => a.outerHTML),
            '页面内不得有无 href 的 <a>'
        ).toEqual([])
    })
})