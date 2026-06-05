import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: 'pomodoro',
    name: 'pomodoro',
    component: () => import('./entry.vue'),
    redirect: '/pomodoro/timer',
    children: [
        {
            path: 'timer/:taskId?',
            name: 'timer',
            props: true,
            component: () => import('@/layouts/pomodoro/timer/index.vue')
        },
        {
            path: 'focus/:taskId?',
            name: 'focus',
            props: true,
            component: () => import('@/layouts/pomodoro/focus/index.vue')
        },
        {
            path: 'history/:taskId?',
            name: 'history',
            props: true,
            component: () => import('@/layouts/pomodoro/history/index.vue')
        }
    ]
}

export default routes

