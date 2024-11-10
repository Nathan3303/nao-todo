import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '@nao-todo/stores/use-user-store'
import tasksRoutes from './tasks'

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
                if (!userStore.isAuthenticated) {
                    const checkinResult = await userStore.checkin()
                    if (checkinResult.code !== 20000 || !userStore.isAuthenticated) {
                        next('/authentication/login')
                        return
                    }
                }
                next()
            },
            component: () => import('../views/index/index.vue'),
            redirect: { name: 'tasks' },
            children: [tasksRoutes]
        }
    ]
})

export default router
