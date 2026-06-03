import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: 'pomodoro',
    name: 'pomodoro',
    component: () => import('./entry.vue'),
    // redirect: '/pomodoro',
    children: []
}

export default routes

