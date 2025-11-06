import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStoreV2 } from '@/stores/global'
import authRoutes from '@/views/auth/routes'
import tasksRoutes from '@/views/tasks/routes'
import calendarRoutes from '@/views/calendar/routes'
import searchRoutes from '@/views/search/routes'
import checkinRoutes from '@/views/checkin/routes'
import settingsRoutes from '@/views/settings/routes'

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        authRoutes,
        checkinRoutes,
        {
            path: '/',
            name: 'index',
            beforeEnter: (to, from, next) => {
                // 用户凭证验证失败或者用户未登录，跳转到登录页
                const userStore = useUserStoreV2()
                if (!userStore.isAuthenticated) {
                    next({ name: 'checkin', params: { fromUrlBase64: btoa(to.fullPath) } })
                    return
                }
                next()
            },
            component: () => import('@/views/index.vue'),
            children: [tasksRoutes, calendarRoutes, searchRoutes, settingsRoutes]
        }
    ]
})

export default router

