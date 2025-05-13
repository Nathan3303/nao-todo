import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: 'fqfocus',
    name: 'fqfocus',
    component: () => import('./index.vue')
}

export default routes
