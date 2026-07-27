import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: 'calendar',
    name: 'calendar',
    component: () => import('./entry.vue'),
    redirect: { name: 'calendar-monthly' },
    children: [
        {
            path: 'monthly',
            name: 'calendar-monthly',
            component: () => import('@/components/calendar/monthly/index.vue')
        }
    ]
}

export default routes