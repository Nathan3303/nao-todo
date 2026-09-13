import { describe, expect, it, vi } from 'vite-plus/test'
import { SHELL_ERROR_LOG_PREFIX } from './error-observability'
import {
    pickSafeNavigationTarget,
    resolveNavigableTarget,
    resolveSectionRedirect,
    safeReplace,
    safeReplaceDeepLink,
    type NavigationCandidate,
    type NavigationStorage,
    type SafeNavigationRouter
} from './safe-navigation'

/**
 * SHELL-05 T4 / C-28 / C-30：安全导航纯层
 * @description 覆盖合法/失效/`/auth/*`/空值四类目标、失效键清理、回退链与 section 决策防循环。
 */

/** 简易 resolve 替身：已知路由表 */
const makeRouter = (routes: string[] = ['/tasks', '/calendar', '/tasks/all', '/tasks/all/table']) =>
    ({
        resolve: (target: string) => {
            const fullPath = target
            const matched = routes.includes(fullPath) ? [{}] : []
            return { matched, fullPath }
        }
    }) as unknown as SafeNavigationRouter

const makeStorage = (): NavigationStorage & { removed: string[] } => {
    const removed: string[] = []
    return { removed, removeItem: (key: string) => removed.push(key) }
}

describe('resolveNavigableTarget - 四类目标（AC5）', () => {
    it('合法目标 → 归一化 fullPath', () => {
        expect(resolveNavigableTarget(makeRouter(), '/tasks/all')).toBe('/tasks/all')
    })
    it('失效目标（matched=0）→ null', () => {
        expect(resolveNavigableTarget(makeRouter(), '/tasks/gone/deep')).toBeNull()
    })
    it('/auth/* → null（禁把登录页当回退目标）', () => {
        const router = makeRouter(['/auth/signin'])
        expect(resolveNavigableTarget(router, '/auth/signin')).toBeNull()
    })
    it('空值 / resolve 抛错 → null', () => {
        expect(resolveNavigableTarget(makeRouter(), '')).toBeNull()
        expect(resolveNavigableTarget(makeRouter(), null)).toBeNull()
        const throwing = {
            resolve: () => {
                throw new Error('boom')
            }
        } as unknown as SafeNavigationRouter
        expect(resolveNavigableTarget(throwing, '/tasks')).toBeNull()
    })
})

describe('pickSafeNavigationTarget - 回退链与失效键清理', () => {
    const router = makeRouter()

    it('首个合法目标胜出（LAST_VISITED 优先于 SECTION）', () => {
        const candidates: NavigationCandidate[] = [
            { key: 'LAST_VISITED_ROUTE', value: '/calendar' },
            { key: 'LAST_TASKS_ROUTE', value: '/tasks' }
        ]
        expect(pickSafeNavigationTarget(router, candidates, '/tasks', makeStorage())).toBe(
            '/calendar'
        )
    })

    it('失效候选项被清理，回落下一合法项', () => {
        const storage = makeStorage()
        const candidates: NavigationCandidate[] = [
            { key: 'LAST_VISITED_ROUTE', value: '/auth/signin' },
            { key: 'LAST_TASKS_ROUTE', value: '/tasks/all' }
        ]
        expect(pickSafeNavigationTarget(router, candidates, '/tasks', storage)).toBe('/tasks/all')
        expect(storage.removed).toEqual(['LAST_VISITED_ROUTE'])
    })

    it('全部失效 → fallback', () => {
        const storage = makeStorage()
        const candidates: NavigationCandidate[] = [
            { key: 'LAST_VISITED_ROUTE', value: '/nope' },
            { key: 'LAST_TASKS_ROUTE', value: '' }
        ]
        expect(pickSafeNavigationTarget(router, candidates, '/tasks', storage)).toBe('/tasks')
        expect(storage.removed).toEqual(['LAST_VISITED_ROUTE'])
    })

    it('router 不可用 → fallback 且不清理（避免误删）', () => {
        const storage = makeStorage()
        const candidates: NavigationCandidate[] = [{ key: 'k', value: '/calendar' }]
        expect(pickSafeNavigationTarget(undefined, candidates, '/tasks', storage)).toBe('/tasks')
        expect(storage.removed).toEqual([])
    })
})

describe('resolveSectionRedirect - section 重定向决策', () => {
    it('合法且不同 → 重定向到该目标', () => {
        expect(resolveSectionRedirect(makeRouter(), '/tasks/all/table', '/tasks')).toEqual({
            target: '/tasks/all/table',
            cleanup: false
        })
    })

    it('失效 → 清理并放行（不把失效字符串当目标、不循环不白屏）', () => {
        expect(resolveSectionRedirect(makeRouter(), '/gone', '/tasks')).toEqual({
            target: null,
            cleanup: true
        })
        expect(resolveSectionRedirect(makeRouter(), '/auth/signin', '/tasks')).toEqual({
            target: null,
            cleanup: true
        })
    })

    it('与当前目标相同 / 解析后等价 → 放行且不清理（防循环）', () => {
        const router = makeRouter()
        expect(resolveSectionRedirect(router, '/tasks', '/tasks')).toEqual({
            target: null,
            cleanup: false
        })
    })

    it('空值 → 放行', () => {
        expect(resolveSectionRedirect(makeRouter(), null, '/tasks')).toEqual({
            target: null,
            cleanup: false
        })
    })
})

describe('pickSafeNavigationTarget - 异常防御', () => {
    it('storage 清理抛错不阻断回退', () => {
        const throwingStorage: NavigationStorage = {
            removeItem: vi.fn(() => {
                throw new Error('storage denied')
            })
        }
        expect(
            pickSafeNavigationTarget(
                makeRouter(),
                [{ key: 'k', value: '/nope' }],
                '/tasks',
                throwingStorage
            )
        ).toBe('/tasks')
    })
})

describe('safeReplace / safeReplaceDeepLink - C-35 统一导航', () => {
    const makeNavigableRouter = (replace: (to: string) => Promise<unknown>): SafeNavigationRouter =>
        ({
            resolve: (target: string) => ({
                matched: ['/tasks', '/tasks/all/table'].includes(target) ? [{}] : [],
                fullPath: target
            }),
            replace
        }) as unknown as SafeNavigationRouter

    it('router 不可用 → 结构化记录且不抛错', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        await expect(safeReplace(undefined, '/tasks', 'src:test')).resolves.toBeUndefined()
        expect(spy).toHaveBeenCalledWith(
            expect.stringContaining(SHELL_ERROR_LOG_PREFIX),
            expect.objectContaining({ source: 'src:test' })
        )
    })

    it('replace reject → 记录且不抛错（不卡死）', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const router = makeNavigableRouter(() => Promise.reject(new Error('nav failed')))
        await expect(safeReplace(router, '/tasks', 'src:test')).resolves.toBeUndefined()
        expect(spy).toHaveBeenCalledWith(
            expect.stringContaining(SHELL_ERROR_LOG_PREFIX),
            expect.objectContaining({ source: 'src:test' })
        )
    })

    it('成功路径 → 调用 replace', async () => {
        const replace = vi.fn().mockResolvedValue(undefined)
        await safeReplace(makeNavigableRouter(replace), '/tasks', 'src:test')
        expect(replace).toHaveBeenCalledWith('/tasks')
    })

    it('safeReplaceDeepLink：失效深链清理并回退 /tasks', async () => {
        const replace = vi.fn().mockResolvedValue(undefined)
        const storage = makeStorage()
        vi.spyOn(console, 'error').mockImplementation(() => {})
        await safeReplaceDeepLink(
            makeNavigableRouter(replace),
            [{ key: 'LAST_VISITED_ROUTE', value: '/gone' }],
            '/tasks',
            'src:test',
            storage
        )
        expect(storage.removed).toEqual(['LAST_VISITED_ROUTE'])
        expect(replace).toHaveBeenCalledWith('/tasks')
    })
})