import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '@/stores/use-user-store'
import { useLoadingScreen } from '@/hooks/use-loading-screen'

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
            redirect: { name: 'project' },
            children: [
                {
                    path: 'project',
                    name: 'project',
                    component: () => import('@/views/index/project/index.vue'),
                    redirect: { name: 'project-dashboard' },
                    children: [
                        {
                            path: 'dashboard',
                            name: 'project-dashboard',
                            component: () => import('@/views/index/project/dashboard.vue')
                        },
                        {
                            path: ':projectId',
                            name: 'project-main',
                            props: true,
                            component: () => import('@/views/index/project/main/main.vue'),
                            redirect: { name: 'project-main-table' },
                            children: [
                                {
                                    path: 'overview',
                                    name: 'project-main-overview',
                                    component: () =>
                                        import('@/views/index/project/main/overview.vue')
                                },
                                {
                                    path: 'table',
                                    name: 'project-main-table',
                                    props: true,
                                    component: () => import('@/views/index/project/main/table.vue')
                                }
                            ]
                        }
                    ]
                },
                {
                    path: 'tasks',
                    name: 'tasks',
                    component: () => import('@/views/index/tasks/index.vue')
                }
            ]
        }
    ]
})

export default router
