// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { resolveSectionRedirect } from '@/safe-navigation'
import calendarRoutes from '../routes'
import {
    CALENDAR_VIEW_NAMES,
    isCalendarViewName,
    resolveViewSwitch,
    viewModeOfRouteName
} from '../view-routes'

/**
 * TASK-18 / T71 路由契约（AC5 / AC7 / C4 / C5 / C10）
 * @description 结构性断言三子路由 + `viewMode` 只读派生映射穷举断言 + 默认落月 +
 *              深链（含 `:taskId?`）+ 切视图幂等/透传。新增用例，不改既有测试文件。
 */

const Dummy = { template: '<div><router-view /></div>' }

/** 克隆日历路由（组件替换为 Dummy，避免测试加载真实视图链） */
const buildRoutes = (): RouteRecordRaw => ({
    path: '/',
    name: 'index',
    component: Dummy,
    children: [
        {
            ...calendarRoutes,
            component: Dummy,
            children: ((calendarRoutes.children ?? []) as RouteRecordRaw[]).map(
                (child) => ({ ...child, component: Dummy }) as RouteRecordRaw
            )
        } as RouteRecordRaw
    ]
})

const buildRouter = () => createRouter({ history: createMemoryHistory(), routes: [buildRoutes()] })

const childNames = (): string[] =>
    (calendarRoutes.children ?? []).map((child) => child.name as string)

describe('T71 AC5/C4 三子路由结构', () => {
    it('父名 calendar 保持；无 redirect（改 beforeEnter，D4 修复前提）', () => {
        expect(calendarRoutes.name).toBe('calendar')
        expect(calendarRoutes.redirect).toBeUndefined()
        expect(typeof calendarRoutes.beforeEnter).toBe('function')
    })

    it('三条子路由名/路径正确，且均带 :taskId?', () => {
        const children = calendarRoutes.children ?? []
        expect(children.map((child) => child.name)).toEqual([
            'calendar-monthly',
            'calendar-weekly',
            'calendar-day'
        ])
        expect(children.map((child) => child.path)).toEqual([
            'monthly/:taskId?',
            'weekly/:taskId?',
            'daily/:taskId?'
        ])
    })

    it('默认入口落月：父级 beforeEnter 仅对 calendar 重定向到 calendar-monthly', () => {
        const beforeEnter = calendarRoutes.beforeEnter as (to: {
            name: string
        }) => { name: string } | undefined
        expect(beforeEnter({ name: 'calendar' })).toEqual({ name: 'calendar-monthly' })
        expect(beforeEnter({ name: 'calendar-weekly' })).toBeUndefined()
    })

    it('路由表名集合 ⊆ 映射键集合（C5 断言：防未来改名后静默回落月视图）', () => {
        const mapped = new Set(Object.keys(CALENDAR_VIEW_NAMES))
        for (const name of childNames()) {
            expect(isCalendarViewName(name), `未在映射表内的路由名：${name}`).toBe(true)
            expect(mapped.has(name)).toBe(true)
        }
        // 反向：映射表无多余键（穷举三条）
        expect(new Set(childNames())).toEqual(mapped)
    })

    it('viewModeOfRouteName：三条名各映射其视图态；未知/父级 → month', () => {
        expect(viewModeOfRouteName('calendar-monthly')).toBe('month')
        expect(viewModeOfRouteName('calendar-weekly')).toBe('week')
        expect(viewModeOfRouteName('calendar-day')).toBe('day')
        expect(viewModeOfRouteName('calendar')).toBe('month')
        expect(viewModeOfRouteName('tasks-built-in-project-main')).toBe('month')
        expect(viewModeOfRouteName(undefined)).toBe('month')
    })
})

describe('T71 AC5 深链可达（含 :taskId?）', () => {
    it('三条路径可解析，且 taskId 可选', () => {
        const router = buildRouter()
        expect(router.resolve({ name: 'calendar-monthly' }).fullPath).toBe('/calendar/monthly')
        expect(router.resolve({ name: 'calendar-weekly' }).fullPath).toBe('/calendar/weekly')
        expect(router.resolve({ name: 'calendar-day' }).fullPath).toBe('/calendar/daily')
        expect(router.resolve({ name: 'calendar-day', params: { taskId: 't-1' } }).fullPath).toBe(
            '/calendar/daily/t-1'
        )
        expect(
            router.resolve({ name: 'calendar-weekly', params: { taskId: 't-2' } }).fullPath
        ).toBe('/calendar/weekly/t-2')
    })

    it('直接访问 /calendar 落到 calendar-monthly（默认月视图）', async () => {
        const router = buildRouter()
        await router.push('/calendar')
        expect(router.currentRoute.value.name).toBe('calendar-monthly')
    })

    it('深链 /calendar/daily/t-1 直达且 taskId 保留', async () => {
        const router = buildRouter()
        await router.push('/calendar/daily/t-1')
        expect(router.currentRoute.value.name).toBe('calendar-day')
        expect(router.currentRoute.value.params.taskId).toBe('t-1')
    })
})

describe('T71 AC7/D4 section 恢复前提', () => {
    it('LAST_CALENDAR_ROUTE 存的是含子路由 + taskId 的 fullPath（父级无 redirect 才可被 beforeEach 命中）', () => {
        const router = buildRouter()
        const saved = router.resolve({
            name: 'calendar-weekly',
            params: { taskId: 't-9' }
        }).fullPath
        expect(saved).toBe('/calendar/weekly/t-9')
        // 恢复目标（fullPath）可被 resolve 回同一路由 ⇒ resolveSectionRedirect 会放行重定向
        const restored = router.resolve(saved)
        expect(restored.name).toBe('calendar-weekly')
        expect(restored.params.taskId).toBe('t-9')
    })

    it('从其他 section 回到 /calendar ⇒ 恢复上次子路由 + taskId（D4 修复生效）', async () => {
        localStorage.setItem('LAST_CALENDAR_ROUTE', '/calendar/weekly/t-9')
        const router = buildRouter()
        router.beforeEach((to) => {
            const sectionName = to.name as string
            if (sectionName !== 'calendar') return true
            const { target, cleanup } = resolveSectionRedirect(
                router,
                localStorage.getItem('LAST_CALENDAR_ROUTE'),
                to.fullPath
            )
            if (cleanup) localStorage.removeItem('LAST_CALENDAR_ROUTE')
            return target ?? true
        })

        await router.push('/calendar')

        expect(router.currentRoute.value.fullPath).toBe('/calendar/weekly/t-9')
        expect(router.currentRoute.value.name).toBe('calendar-weekly')
        localStorage.removeItem('LAST_CALENDAR_ROUTE')
    })
})

describe('T71 AC5/C10 切视图导航契约（幂等 + 透传）', () => {
    it('目标与当前一致 ⇒ 返回 null（幂等短路，不触发冗余 replace）', () => {
        const router = buildRouter()
        const route = {
            fullPath: '/calendar/weekly/t-1',
            params: { taskId: 't-1' },
            query: {}
        }
        expect(resolveViewSwitch(router, route, 'calendar-weekly')).toBeNull()
    })

    it('切换视图时 taskId 与 query 原样透传', () => {
        const router = buildRouter()
        const route = {
            fullPath: '/calendar/weekly/t-1?focus=1',
            params: { taskId: 't-1' },
            query: { focus: '1' }
        }
        const target = resolveViewSwitch(router, route, 'calendar-day')
        expect(target).toEqual({
            name: 'calendar-day',
            params: { taskId: 't-1' },
            query: { focus: '1' }
        })
        expect(router.resolve(target!).fullPath).toBe('/calendar/daily/t-1?focus=1')
    })

    it('无 taskId 时切换不写入空参数', () => {
        const router = buildRouter()
        const target = resolveViewSwitch(
            router,
            { fullPath: '/calendar/monthly', params: {}, query: {} },
            'calendar-weekly'
        )
        expect(router.resolve(target!).fullPath).toBe('/calendar/weekly')
    })
})