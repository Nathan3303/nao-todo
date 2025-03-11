import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: 'calendar',
    name: 'calendar',
    component: () => import('./index.vue')
}

export default routes
