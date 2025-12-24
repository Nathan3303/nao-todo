import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: 'search',
    name: 'search',
    component: () => import('./entry.vue')
}

export default routes
