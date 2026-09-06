import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: 'search/:taskId?',
    name: 'search',
    component: () => import('./entry.vue'),
    // redirect: '/search',
    children: []
}

export default routes