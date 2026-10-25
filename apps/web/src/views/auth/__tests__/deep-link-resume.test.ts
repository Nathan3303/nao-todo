// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { AUTH_VIEW_CONTEXT_KEY } from '../context'

/**
 * DEF-59（T539 红基线）深链优先 —— auth 恢复后的**落点优先级**
 *
 * 现场链路（读码证据）：冷加载 `#/tasks/all/kanban/t1`
 *   1. `apps/web/src/views/auth/routes.ts` 的 beforeEnter 见 JWT 但 store 未认证 ⇒ 抛回 `auth-checkin`，
 *      **URL 目标未被带走**（URL 变成 `#/auth/checkin`）；
 *   2. 检入成功后 `components/auth/check-in-page.vue` 按 `LAST_VISITED_ROUTE` 跳 ⇒ **深链被上次访问顶掉**。
 *
 * 用例契约（PRD `docs/prds/2026-10-25-correctness-batch.md` R3 / AC4 / AC5）：
 * - 优先级：`query.redirect`（显式深链目标）> `LAST_VISITED_ROUTE` > `LAST_TASKS_ROUTE` > `/tasks`；
 * - `LAST_VISITED_ROUTE` **键名不变**（18 处引用只改「谁优先」）；
 * - 非法 `redirect` ⇒ 走既有回退链（不报错、不得把非法串当目标）。
 */

const mocks = vi.hoisted(() => ({
    replace: vi.fn(),
    routeQuery: { value: {} as Record<string, string> },
    resolveTargets: { value: [] as string[] },
    revokeOfflineEntry: vi.fn()
}))

vi.mock('vue-router', () => ({
    useRouter: () => ({
        replace: mocks.replace,
        resolve: (target: string) => ({
            matched: mocks.resolveTargets.value.includes(target) ? [{}] : [],
            fullPath: target
        })
    }),
    useRoute: () => ({
        name: 'auth-checkin',
        query: mocks.routeQuery.value,
        fullPath: '/auth/checkin'
    })
}))

// 键名冻结（R3 只改「谁优先」）：与被测页解耦，避免拉入真实 router（含全局守卫/懒加载路由）
vi.mock('@/router', () => ({ LAST_VISITED_ROUTE_KEY: 'LAST_VISITED_ROUTE' }))

vi.mock('../offline-entry', () => ({ revokeOfflineEntry: mocks.revokeOfflineEntry }))

/** 身份域叶子桩：只暴露「成功」事件，避免挂载真实登录/检入 UI */
vi.mock('@nao-todo/presentation-identity', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@nao-todo/presentation-identity')>()
    const successStub = (name: string, event: string) =>
        defineComponent({
            name,
            emits: [event],
            template: `<button class="emit-success" @click="$emit('${event}')">ok</button>`
        })
    return {
        ...actual,
        AuthSignIn: successStub('AuthSignIn', 'sign-in-success'),
        AuthCheckIn: successStub('AuthCheckIn', 'check-in-success')
    }
})

const { default: CheckInPage } = await import('@/components/auth/check-in-page.vue')
const { default: SignInPage } = await import('@/components/auth/sign-in-page.vue')

const DEEP_LINK = '/tasks/all/kanban/t1'
const LAST_VISITED = '/calendar'

let wrapper: VueWrapper | null = null

const mountPage = (page: unknown): VueWrapper => {
    wrapper = mount(page as never, {
        global: {
            provide: {
                [AUTH_VIEW_CONTEXT_KEY as symbol]: { authUseCase: {} }
            }
        }
    })
    return wrapper
}

const succeed = async (view: VueWrapper): Promise<void> => {
    await view.find('.emit-success').trigger('click')
    await flushPromises()
}

beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.replace.mockResolvedValue(undefined)
    mocks.routeQuery.value = {}
    // 与真实路由一致：`/tasks`、`/calendar`、`/tasks/all/kanban/t1` 合法；`/gone/deep` 非法
    mocks.resolveTargets.value = ['/tasks', '/calendar', DEEP_LINK]
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('DEF-59/AC4：冷加载深链优先于「上次访问」', () => {
    it('检入成功：query.redirect 存在 ⇒ 落深链目标（不是 LAST_VISITED_ROUTE）', async () => {
        mocks.routeQuery.value = { redirect: DEEP_LINK }
        localStorage.setItem('LAST_VISITED_ROUTE', LAST_VISITED)

        await succeed(mountPage(CheckInPage))

        expect(mocks.replace).toHaveBeenCalledTimes(1)
        expect(mocks.replace).toHaveBeenCalledWith(DEEP_LINK)
    })

    it('登录成功：query.redirect 存在 ⇒ 落深链目标（不是 LAST_VISITED_ROUTE）', async () => {
        mocks.routeQuery.value = { redirect: DEEP_LINK }
        localStorage.setItem('LAST_VISITED_ROUTE', LAST_VISITED)

        await succeed(mountPage(SignInPage))

        expect(mocks.replace).toHaveBeenCalledTimes(1)
        expect(mocks.replace).toHaveBeenCalledWith(DEEP_LINK)
    })

    it('无 query.redirect ⇒ 仍按 LAST_VISITED_ROUTE 回落（既有行为不变）', async () => {
        localStorage.setItem('LAST_VISITED_ROUTE', LAST_VISITED)

        await succeed(mountPage(CheckInPage))

        expect(mocks.replace).toHaveBeenCalledWith(LAST_VISITED)
    })

    it('无 query.redirect 且无 LAST_VISITED_ROUTE ⇒ 落 /tasks（既有行为不变）', async () => {
        await succeed(mountPage(SignInPage))

        expect(mocks.replace).toHaveBeenCalledWith('/tasks')
    })
})

describe('DEF-59/AC5：非法深链目标走既有回退，且不报错', () => {
    it('query.redirect 非法 ⇒ 不得当作目标，回落 LAST_VISITED_ROUTE', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        mocks.routeQuery.value = { redirect: '/gone/deep' }
        localStorage.setItem('LAST_VISITED_ROUTE', LAST_VISITED)

        await succeed(mountPage(CheckInPage))

        expect(mocks.replace).toHaveBeenCalledTimes(1)
        expect(mocks.replace).toHaveBeenCalledWith(LAST_VISITED)
        expect(mocks.replace).not.toHaveBeenCalledWith('/gone/deep')
        expect(errorSpy).not.toHaveBeenCalled()
    })

    it('query.redirect 与 LAST_VISITED_ROUTE 均非法 ⇒ 落 /tasks，且不报错', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        mocks.routeQuery.value = { redirect: '/gone/deep' }
        localStorage.setItem('LAST_VISITED_ROUTE', '/also/gone')

        await succeed(mountPage(SignInPage))

        expect(mocks.replace).toHaveBeenCalledTimes(1)
        expect(mocks.replace).toHaveBeenCalledWith('/tasks')
        expect(errorSpy).not.toHaveBeenCalled()
    })

    it('非法 LAST_VISITED_ROUTE 被清理（键名不变，避免下次再撞）', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        localStorage.setItem('LAST_VISITED_ROUTE', '/also/gone')

        await succeed(mountPage(CheckInPage))

        expect(mocks.replace).toHaveBeenCalledWith('/tasks')
        expect(localStorage.getItem('LAST_VISITED_ROUTE')).toBeNull()
    })
})