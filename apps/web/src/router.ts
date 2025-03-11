import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '@/stores/use-user-store'
import authRoutes from '@/views/auth/routes'
import tasksRoutes from '@/views/index/tasks/routes'
import calendarRoutes from '@/views/index/calendar/routes'
import fqfocusRoutes from '@/views/index/fqfocus/routes'
import searchRoutes from '@/views/index/search/routes'
import aiRoutes from '@/views/index/ai/routes'

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        authRoutes,
        {
            path: '/checkin/:fromUrlBase64?',
            name: 'checkin',
            props: true,
            component: () => import('@/views/checkin/index.vue')
        },
        {
            path: '/',
            name: 'index',
            beforeEnter: (to, from, next) => {
                const userStore = useUserStore()
                if (!userStore.isAuthenticated) {
                    next({ name: 'checkin', params: { fromUrlBase64: btoa(to.fullPath) } })
                    return
                }
                next()
            },
            component: () => import('@/views/index/index.vue'),
            redirect: { name: 'tasks' },
            children: [tasksRoutes, calendarRoutes, fqfocusRoutes, searchRoutes, aiRoutes]
        }
    ]
})

export default router
