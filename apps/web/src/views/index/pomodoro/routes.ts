import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: 'pomodoro',
    component: () => import('./entry.vue'),
    children: [
        { path: '', redirect: '/pomodoro/timer' },
        {
            path: 'pomodoros',
            name: 'pomodoro-collection',
            component: () => import('@/components/pomodoro/collection/index.vue')
        },
        {
            path: 'records',
            name: 'pomodoro-records',
            component: () => import('@/components/pomodoro/records/index.vue')
        },
        {
            path: ':type(timer|focus)/:taskId?',
            name: 'pomodoro',
            props: true,
            component: () => import('@/components/pomodoro/index.vue')
        }
    ]
}

export default routes