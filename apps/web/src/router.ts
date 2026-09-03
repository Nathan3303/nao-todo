import { createRouter, createWebHashHistory } from 'vue-router'
import authRoutes, { beforeEnter as authBeforeEnter } from '@/views/auth/routes'
import indexRoutes from '@/views/index/routes'

const LAST_VISITED_ROUTE_KEY = 'LAST_VISITED_ROUTE'

const SECTION_LAST_ROUTE_MAP: Record<string, string> = {
    tasks: 'LAST_TASKS_ROUTE',
    calendar: 'LAST_CALENDAR_ROUTE',
    settings: 'LAST_SETTINGS_ROUTE'
}

const router = createRouter({
    history: createWebHashHistory(),
    routes: [authRoutes, { ...indexRoutes, beforeEnter: authBeforeEnter }]
})

router.beforeEach((to) => {
    const sectionName = to.name as string
    if (sectionName in SECTION_LAST_ROUTE_MAP) {
        const savedRoute = localStorage.getItem(SECTION_LAST_ROUTE_MAP[sectionName]!)
        if (savedRoute && savedRoute !== to.fullPath) {
            return savedRoute
        }
    }
    return true
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