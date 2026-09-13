import { createRouter, createWebHashHistory } from 'vue-router'
import authRoutes, { beforeEnter as authBeforeEnter } from '@/views/auth/routes'
import indexRoutes from '@/views/index/routes'
import { resolveSectionRedirect } from '@/safe-navigation'

const LAST_VISITED_ROUTE_KEY = 'LAST_VISITED_ROUTE'

export const SECTION_LAST_ROUTE_MAP: Record<string, string> = {
    tasks: 'LAST_TASKS_ROUTE',
    calendar: 'LAST_CALENDAR_ROUTE'
}

const router = createRouter({
    history: createWebHashHistory(),
    routes: [authRoutes, { ...indexRoutes, beforeEnter: authBeforeEnter }]
})

router.beforeEach((to) => {
    const sectionName = to.name as string
    if (!(sectionName in SECTION_LAST_ROUTE_MAP)) return true
    const key = SECTION_LAST_ROUTE_MAP[sectionName]!
    const savedRoute = localStorage.getItem(key)
    const { target, cleanup } = resolveSectionRedirect(router, savedRoute, to.fullPath)
    // C-30：失效目标清理（避免下次再撞）；不把失效字符串当重定向目标
    if (cleanup) localStorage.removeItem(key)
    return target ?? true
})

router.afterEach((to) => {
    if (!to.path.startsWith('/auth')) {
        localStorage.setItem(LAST_VISITED_ROUTE_KEY, to.fullPath)
        const topLevelRoute = to.matched[1]
        if (topLevelRoute?.name) {
            const sectionName = topLevelRoute.name as string
            if (sectionName in SECTION_LAST_ROUTE_MAP) {
                localStorage.setItem(SECTION_LAST_ROUTE_MAP[sectionName]!, to.fullPath)
            }
        }
    }
    return true
})

export default router
export { LAST_VISITED_ROUTE_KEY }