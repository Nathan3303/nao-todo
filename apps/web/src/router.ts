import { createRouter, createWebHashHistory } from 'vue-router'
import authRoutes, { beforeEnter as authBeforeEnter } from '@/views/auth/routes'
import indexRoutes from '@/views/index/routes'

const LAST_VISITED_ROUTE_KEY = 'LAST_VISITED_ROUTE'

const router = createRouter({
    history: createWebHashHistory(),
    routes: [authRoutes, { ...indexRoutes, beforeEnter: authBeforeEnter }]
})

router.afterEach((to) => {
    if (!to.path.startsWith('/auth')) {
        localStorage.setItem(LAST_VISITED_ROUTE_KEY, to.fullPath)
    }
})

export default router
export { LAST_VISITED_ROUTE_KEY }

