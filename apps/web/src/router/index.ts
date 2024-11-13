import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '@/stores/use-user-store'
import tasksRoutes from './tasks'

const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/auth/:operation?',
            name: 'authentication',
            props: true,
            component: () => import('@/views/auth/index.vue')
        },
        {
            path: '/',
            name: 'index',
            beforeEnter: async (to, from, next) => {
                const userStore = useUserStore()
                if (!userStore.isAuthenticated) {
                    const checkinResult = await userStore.doCheckin()
                    console.log(checkinResult, userStore.isAuthenticated)
                    if (!checkinResult && !userStore.isAuthenticated) {
                        next('/auth/login')
                        return
                    }
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
                }
            ]
        }
    ]
})

export default router
