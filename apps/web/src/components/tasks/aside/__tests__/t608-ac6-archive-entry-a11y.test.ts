// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { nueUI } from '@/nue-ui-register'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { TASKS_VIEW_CONTEXT_KEY } from '@/views/index/tasks/context'
import { useBuiltInProjectsStore } from '@nao-todo/presentation/built-in-project'
import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { PROJECT_MANAGER_DIALOG_KEY } from '@nao-todo/shared/constants'
import { t } from '@nao-todo/shared/locales'
import tasksRoutes from '@/views/index/tasks/routes'
import TasksAside from '../aside.vue'

/**
 * T608 AC6 —— 「已归档」入口键盘可达（`DEF-124` · PRD `2026-10-31-kanban-priority-grouping.md`）
 *
 * @description 现状：`aside.vue` 用 `<nue-link icon="archive" theme="route" @click>` **无 `route`**
 *              ⇒ 渲染无 `href` 的 `<a>` ⇒ 键盘不可达。PRD 要求改可聚焦形态（`<button>` 语义或补
 *              `href` + 点击拦截），且**触发行为与改动前逐项等价**。
 *
 * **基线行为快照**（`T608` 开工时在**未改动产品代码**上实测，`aside.vue` 与 `main` 逐字节一致）：
 *   - 元素：`<a class="nue-link nue-link--route">`（**无 href**），`tabIndex = 0`（jsdom 对无 href
 *     锚点也报 0 ⇒ 不可单用），但 `element.focus()` 后 `document.activeElement` **未命中** ⇒ 不可聚焦；
 *   - 点击 ⇒ `appDialogManager.open(PROJECT_MANAGER_DIALOG_KEY, { activeTab: 'archived' })` **1 次**；
 *   - 路由：`/tasks/all` → `/tasks/all`（**不跳转**，纯弹窗）。
 * 本文件用上述快照做等价断言（挂载方式与快照探针一致：真 router + 真 pinia + 真 `nue-*`）。
 *
 * 键盘口径（与 `T580` 一致）：**jsdom 不实现原生 `<button>` 的 Enter 隐式激活**，因此 Enter 行为
 * 断言为「原生可激活形态 + 可聚焦 + 有可访问名 + 未被 disabled/aria-disabled/tabindex 剥夺」——
 * 这四项就是真实浏览器里 Enter 能触发的前提；点击行为另用等价快照锁死。
 *
 * 状态：**红**（入口不可聚焦：`focus()` 后 `activeElement` 未命中）。
 */

const stub = { template: '<div />' }

const withStubComponents = (route: RouteRecordRaw): RouteRecordRaw =>
    ({
        ...route,
        component: stub,
        ...(route.components
            ? {
                  components: Object.fromEntries(
                      Object.keys(route.components).map((k) => [k, stub])
                  )
              }
            : {}),
        ...(route.children ? { children: route.children.map(withStubComponents) } : {})
    }) as RouteRecordRaw

const buildRouter = () =>
    createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/', component: stub, children: [withStubComponents(tasksRoutes)] }]
    })

/** 真实内建清单 id（`packages/infrastructure/src/built-in/project/default.ts`） */
const BUILT_IN_IDS = ['all', 'today', 'tomorrow', 'week', 'inbox', 'favourite', 'deleted']

const ENTRY_LABEL = t('common.archived')

let wrapper: VueWrapper | null = null
let open: ReturnType<typeof vi.fn>

beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    open = vi.fn()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

const mountTasksAside = async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = buildRouter()
    useBuiltInProjectsStore().setBuiltInProjects(
        BUILT_IN_IDS.map((id, index) => ({
            id,
            name: `内建 ${index + 1}`,
            icon: 'list'
        })) as never
    )
    useProjectsStore().setProjects([] as never)
    useTagsStore().setTags([] as never)
    await router.push('/tasks/all')
    await router.isReady()

    wrapper = mount(TasksAside, {
        attachTo: document.body,
        global: {
            plugins: [pinia, router, nueUI],
            stubs: { teleport: true },
            provide: {
                [INDEX_VIEW_CONTEXT_KEY as symbol]: {
                    asideWidth: ref(300),
                    handleResizeAside: vi.fn(),
                    isDisplayAside: ref(true),
                    isUseFloatAside: ref(false),
                    setControllOption: vi.fn()
                },
                [TASKS_VIEW_CONTEXT_KEY as symbol]: { appDialogManager: { open } }
            }
        }
    })
    await flushPromises()
    return { wrapper, router }
}

/** 「已归档」入口元素：文本命中标签的最深节点 → 向上取最近的 `a` / `button` */
const entryElement = (w: VueWrapper): HTMLElement => {
    const leaves = w
        .findAll('*')
        .filter((n) => (n.text() ?? '').trim() === ENTRY_LABEL && n.element.children.length === 0)
    const [leaf] = leaves
    expect(
        leaf,
        `未找到「${ENTRY_LABEL}」入口（实测文本节点：${JSON.stringify(
            w
                .findAll('span')
                .map((n) => (n.text() ?? '').trim())
                .filter(Boolean)
        )}）`
    ).toBeTruthy()
    const el = (leaf!.element.closest('a, button') ?? leaf!.element) as HTMLElement
    return el
}

const describeEntry = (el: HTMLElement): string =>
    JSON.stringify({
        tag: el.tagName,
        outerHTML: el.outerHTML,
        tabIndex: el.tabIndex,
        href: el.getAttribute('href'),
        disabled: el.hasAttribute('disabled'),
        ariaDisabled: el.getAttribute('aria-disabled')
    })

describe('T608 AC6 · 「已归档」入口键盘可达且行为等价', () => {
    it('AC6① 入口存在、tabIndex >= 0、focus() 后 activeElement 命中', async () => {
        const { wrapper: w } = await mountTasksAside()
        const el = entryElement(w)
        const detail = describeEntry(el)

        expect(el.tabIndex, `tabIndex 实测：${detail}`).toBeGreaterThanOrEqual(0)
        el.focus()
        expect(
            document.activeElement === el,
            `focus() 后未命中（不可聚焦 ⇒ Tab/Enter 都到不了）：${detail}`
        ).toBe(true)
    })

    it('AC6② 原生可激活形态（button 或带 href 的 a）+ 未被 disabled 剥夺 + 有可访问名', async () => {
        const { wrapper: w } = await mountTasksAside()
        const el = entryElement(w)
        const detail = describeEntry(el)

        const nativelyActivatable =
            el.tagName === 'BUTTON' ||
            (el.tagName === 'A' && !!el.getAttribute('href') && el.getAttribute('href') !== '#')
        expect(
            nativelyActivatable,
            `非原生可激活形态 ⇒ 真实浏览器里 Enter 不会触发（role/tabindex 兜底不算解决）：${detail}`
        ).toBe(true)
        expect(el.hasAttribute('disabled'), detail).toBe(false)
        expect(el.getAttribute('aria-disabled'), detail).not.toBe('true')
        expect(
            (el.getAttribute('aria-label') || el.title || el.textContent || '').trim(),
            `无可访问名：${detail}`
        ).not.toBe('')
    })

    it("AC6③ 点击行为与基线快照等价：open(PROJECT_MANAGER_DIALOG_KEY, { activeTab: 'archived' }) 且不跳转", async () => {
        const { wrapper: w, router } = await mountTasksAside()
        const el = entryElement(w)
        const before = router.currentRoute.value.fullPath

        el.click()
        await flushPromises()

        expect(
            open,
            `实测调用 = ${JSON.stringify(open.mock.calls.map(([k, p]) => [String(k), p]))}`
        ).toHaveBeenCalledTimes(1)
        expect(open.mock.calls[0]![0], '首个入参必须是清单管理器对话框 key').toBe(
            PROJECT_MANAGER_DIALOG_KEY
        )
        expect(open.mock.calls[0]![1], '负载必须置 archived tab（与基线一致）').toEqual({
            activeTab: 'archived'
        })
        expect(router.currentRoute.value.fullPath, '基线不跳转（纯弹窗）').toBe(before)
    })

    it('AC6④ 键盘路径未被任何祖先剥夺（不在 aria-hidden / tabindex=-1 容器内）', async () => {
        const { wrapper: w } = await mountTasksAside()
        const el = entryElement(w)

        let cursor: HTMLElement | null = el
        const offenders: string[] = []
        while (cursor) {
            if (cursor.getAttribute('aria-hidden') === 'true') offenders.push('aria-hidden=true')
            if (cursor !== el && cursor.getAttribute('tabindex') === '-1')
                offenders.push('tabindex=-1 祖先')
            if (cursor.getAttribute('inert') !== null) offenders.push('inert')
            cursor = cursor.parentElement
        }
        expect(
            offenders,
            `键盘路径被剥夺：${offenders.join(', ')}；入口 ${describeEntry(el)}`
        ).toEqual([])
    })
})