import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: '/auth',
    name: 'auth',
    props: true,
    component: () => import('./index.vue'),
    redirect: { name: 'signin' },
    children: [
        {
            path: 'signin',
            name: 'signin',
            component: () => import('@/layouts/auth/sign-in.vue')
        },
        {
            path: 'signup',
            name: 'signup',
            component: () => import('@/layouts/auth/sign-up.vue')
        }
    ]
}

export default routes
