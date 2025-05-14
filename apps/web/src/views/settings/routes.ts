import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: 'settings',
    name: 'settings',
    component: () => import('./index.vue'),
    redirect: { name: 'settings-profile' },
    children: [
        {
            path: 'profile',
            name: 'settings-profile',
            component: () => import('./profile/index.vue')
        },
        {
            path: 'account',
            name: 'settings-account',
            component: () => import('./account/index.vue')
        },
        {
            path: 'password',
            name: 'settings-password',
            component: () => import('./password/index.vue')
        }
    ]
}

export default routes
