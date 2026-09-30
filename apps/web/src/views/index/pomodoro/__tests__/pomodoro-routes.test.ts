// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import pomodoroRoutes from '../routes'
import calendarRoutes from '../../calendar/routes'
import searchRoutes from '../../search/routes'
import tasksRoutes from '../../tasks/routes'

/**
 * T451 番茄页子视图切换保留 `taskId`（②）
 * @description 只修番茄页：`pomodoros`/`records` 两条子路由补 `:taskId?`；
 *              四个子视图间切换时 `route.params.taskId` 不变 ⇒ `TaskDetailsAdapter`
 *              的 `taskId` 不变 ⇒ 详情面板不重置。
 *              回归：calendar / search / tasks 的叶子 `:taskId?` 仍在（⛔ 本轮不改它们）。
 */

const stub = { template: '<div />' }

/** 用 stub 替换 lazy 组件（只验证路由表 path/name/params 语义，避免拉入重量组件） */
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
        routes: [
            {
                path: '/',
                component: stub,
                children: [withStubComponents(pomodoroRoutes)]
            }
        ]
    })

describe('T451 番茄页路由：`:taskId?` 深链解析', () => {
    it('`/pomodoro/pomodoros/<taskId>` 解析出 taskId（红：改前无该参数）', () => {
        const router = buildRouter()
        const r = router.resolve('/pomodoro/pomodoros/abc')
        expect(r.name).toBe('pomodoro-collection')
        expect(r.params.taskId).toBe('abc')
    })

    it('`/pomodoro/records/<taskId>` 解析出 taskId', () => {
        const router = buildRouter()
        const r = router.resolve('/pomodoro/records/abc')
        expect(r.name).toBe('pomodoro-records')
        expect(r.params.taskId).toBe('abc')
    })

    it('`/pomodoro/timer/<taskId>` 与 `/pomodoro/focus/<taskId>` 解析出 taskId', () => {
        const router = buildRouter()
        expect(router.resolve('/pomodoro/timer/abc').params.taskId).toBe('abc')
        expect(router.resolve('/pomodoro/focus/abc').params.taskId).toBe('abc')
    })
})

describe('T451 番茄页子视图切换：taskId 不丢', () => {
    it('番茄钟(带详情) → 常用专注 → 专注记录 → 正计时：全程 taskId 恒为 abc', async () => {
        const router = buildRouter()
        await router.push('/pomodoro/timer/abc')
        expect(router.currentRoute.value.params.taskId).toBe('abc')

        await router.push({ name: 'pomodoro-collection', params: { taskId: 'abc' } })
        expect(router.currentRoute.value.name).toBe('pomodoro-collection')
        expect(router.currentRoute.value.params.taskId).toBe('abc')

        await router.push({ name: 'pomodoro-records', params: { taskId: 'abc' } })
        expect(router.currentRoute.value.params.taskId).toBe('abc')

        await router.push({ name: 'pomodoro', params: { type: 'focus', taskId: 'abc' } })
        expect(router.currentRoute.value.params.taskId).toBe('abc')
        expect(router.currentRoute.value.params.type).toBe('focus')
    })

    it('关闭详情（taskId=undefined）⇒ 参数被清理', async () => {
        const router = buildRouter()
        await router.push('/pomodoro/timer/abc')
        await router.push({ name: 'pomodoro-collection', params: { taskId: undefined } })
        expect(router.currentRoute.value.name).toBe('pomodoro-collection')
        expect(router.currentRoute.value.params.taskId).toBeUndefined()
    })

    it('无 taskId 时切子视图 ⇒ 不产生冗余参数段', async () => {
        const router = buildRouter()
        await router.push({ name: 'pomodoro-collection', params: { taskId: undefined } })
        expect(router.currentRoute.value.fullPath).toBe('/pomodoro/pomodoros')
    })
})

describe('T451 回归：其余视图叶子 `:taskId?` 仍在（⛔ 本轮不改）', () => {
    const collect = (
        route: RouteRecordRaw,
        acc: { name?: string; path: string }[] = []
    ): { name?: string; path: string }[] => {
        const name = typeof route.name === 'string' ? route.name : undefined
        acc.push({ name, path: route.path })
        route.children?.forEach((child) => collect(child, acc))
        return acc
    }

    it('calendar 三条子视图含 `:taskId?`', () => {
        const leaves = collect(calendarRoutes)
        for (const n of ['calendar-monthly', 'calendar-weekly', 'calendar-day']) {
            const leaf = leaves.find((l) => l.name === n)
            expect(leaf?.path).toContain(':taskId?')
        }
    })

    it('search 含 `:taskId?`', () => {
        expect(searchRoutes.path).toContain(':taskId?')
    })

    it('tasks 三条主视图含 `:taskId?`', () => {
        const leaves = collect(tasksRoutes)
        for (const n of ['tasks-built-in-project-main', 'tasks-project-main', 'tasks-tag-main']) {
            const leaf = leaves.find((l) => l.name === n)
            expect(leaf?.path).toContain(':taskId?')
        }
    })
})