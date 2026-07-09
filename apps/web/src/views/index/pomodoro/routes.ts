import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: 'pomodoro',
    component: () => import('./entry.vue'),
    children: [
        {
            path: '',
            redirect: '/pomodoro/timer'
        },
        {
            path: 'pomodoros',
            name: 'pomodoro-collection',
            component: () => import('@/layouts/pomodoro/collection/index.vue')
        },
        {
            path: ':type(timer|focus)/:taskId?',
            name: 'pomodoro',
            props: true,
            component: () => import('@/layouts/pomodoro/index.vue')
        }
    ]
}

export default routes
