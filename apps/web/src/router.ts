import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '@/stores'
import authRoutes from '@/views/auth/routes'
import tasksRoutes from '@/views/tasks/routes'
import calendarRoutes from '@/views/calendar/routes'
import fqfocusRoutes from '@/views/fqfocus/routes'
import searchRoutes from '@/views/search/routes'
import aiRoutes from '@/views/ai/routes'
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
            beforeEnter: (to) => {
                const userStore = useUserStore()
                if (userStore.isAuthenticated) return true
                return { name: 'checkin', params: { fromUrlBase64: btoa(to.fullPath) } }
            },
            component: () => import('@/views/index.vue'),
            redirect: { name: 'tasks' },
            children: [
                tasksRoutes,
                calendarRoutes,
                fqfocusRoutes,
                searchRoutes,
                aiRoutes,
                settingsRoutes
            ]
        }
    ]
})

export default router
