import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: '/checkin/:fromUrlBase64?',
    name: 'checkin',
    props: true,
    component: () => import('./index.vue')
}

export default routes