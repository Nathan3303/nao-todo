import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: '/auth/:operation?',
    name: 'auth',
    props: true,
    component: () => import('./index.vue')
}

export default routes
