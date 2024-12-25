import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '@/stores/use-user-store'
import tasksRoutes from './tasks'

const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/auth/:operation?',
            name: 'auth',
            props: true,
            component: () => import('@/views/auth/index.vue')
        },
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
            children: [
                tasksRoutes,
                {
                    path: 'calendar',
                    name: 'calendar',
                    component: () => import('@/views/index/calendar/index.vue')
                },
                {
                    path: 'fqfocus',
                    name: 'fqfocus',
                    component: () => import('@/views/index/fqfocus/index.vue')
                },
                {
                    path: 'search',
                    name: 'search',
                    component: () => import('@/views/index/search/index.vue')
                }
            ]
        }
    ]
})

export default router
