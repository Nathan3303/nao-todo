import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '@nao-todo/stores/use-user-store'
import tasksRoutes from './routes/tasks'

const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/authentication/:operation?',
            name: 'authentication',
            props: true,
            component: () => import('../views/authentication/index.vue')
        },
        {
            path: '/',
            name: 'index',
            beforeEnter: async (to, from, next) => {
                const userStore = useUserStore()
                const isLoggedIn = userStore.isLoggedIn()
                if (!isLoggedIn) {
                    next('/authentication/login')
                    return
                }
                try {
                    await userStore.checkin()
                    if (userStore.isAuthenticated) {
                        next()
                        return
                    }
                    throw new Error('User is not authenticated')
                } catch (e) {
                    next('/authentication/login')
                }
            },
            component: () => import('@/views/index/index.vue'),
            redirect: { name: 'tasks' },
            children: [tasksRoutes]
        }
    ]
})

export default router
