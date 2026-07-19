import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: 'pomodoro',
    component: () => import('./entry.vue'),
    children: [
        { path: '', redirect: '/pomodoro/timer' },
        {
            path: 'pomodoros',
            name: 'pomodoro-collection',
            component: () =>
                import('@nao-todo/domain/pomodoro/components/collection/collection.vue')
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
