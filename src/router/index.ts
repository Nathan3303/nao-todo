import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '@/stores/use-user-store'
import { useLoadingScreen } from '@/hooks/use-loading-screen'
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
            beforeEnter: async (_to, _from, next) => {
                const userStore = useUserStore()
                const loadingScreen = useLoadingScreen()
                if (userStore.isAuthenticated) {
                    next()
                    return
                }
                const isLoggedIn = await userStore.isLoggedIn()
                if (isLoggedIn) {
                    loadingScreen.startLoading()
                    await userStore.checkin()
                    if (userStore.isAuthenticated) {
                        next()
                        return
                    } else {
                        loadingScreen.stopLoading()
                    }
                }
                next('/authentication/login')
            },
            component: () => import('@/views/index/index.vue'),
            redirect: { name: 'tasks' },
            children: [tasksRoutes]
        }
    ]
})

router.afterEach((to) => {
    const { meta } = to
    if (meta && meta.title) {
        document.title = ('NaoTodo - ' + meta.title) as string
    } else {
        document.title = 'NaoTodo'
    }
})

export default router
