import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: 'calendar',
    name: 'calendar',
    component: () => import('./entry.vue'),
    redirect: '/calendar/monthly',
    children: [
        {
            path: 'monthly',
            name: 'monthly',
            component: () => import('@/components/calendar/monthly/index.vue')
        }
        // {
        //     path: 'yearly',
        //     name: 'yearly',
        //     component: () => import('@/components/calendar/yearly/index.vue')
        // },
        // {
        //     path: 'weekly',
        //     name: 'weekly',
        //     component: () => import('@/components/calendar/weekly/index.vue')
        // },
        // {
        //     path: 'daily',
        //     name: 'daily',
        //     component: () => import('@/components/calendar/daily/index.vue')
        // }
    ]
}

export default routes
