import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: 'ai',
    name: 'ai',
    component: () => import('./index.vue')
}

export default routes