import { createRouter, createWebHashHistory } from 'vue-router'
import authRoutes, { beforeEnter as authBeforeEnter } from '@/views/auth/routes'
import tasksRoutes from '@/views/tasks/routes'
// import calendarRoutes from '@/views/calendar/routes'
import searchRoutes from '@/views/search/routes'
// import settingsRoutes from '@/views/settings/routes'

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        authRoutes,
        {
            path: '/',
            name: 'index',
            beforeEnter: authBeforeEnter,
            component: () => import('@/views/index.vue'),
            children: [
                tasksRoutes,
                searchRoutes
                // calendarRoutes, , settingsRoutes
            ]
        }
    ]
})

export default router
