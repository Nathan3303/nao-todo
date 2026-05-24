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
            component: () => import('@/layouts/calendar/monthly/index.vue')
        }
        // {
        //     path: 'yearly',
        //     name: 'yearly',
        //     component: () => import('@/layouts/calendar/yearly/index.vue')
        // },
        // {
        //     path: 'weekly',
        //     name: 'weekly',
        //     component: () => import('@/layouts/calendar/weekly/index.vue')
        // },
        // {
        //     path: 'daily',
        //     name: 'daily',
        //     component: () => import('@/layouts/calendar/daily/index.vue')
        // }
    ]
}

export default routes

