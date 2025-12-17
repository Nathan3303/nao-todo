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
            component: () => import('@/views/auth/main/content/sign-in.vue')
        },
        {
            path: 'signup',
            name: 'signup',
            component: () => import('@/views/auth/main/content/sign-up.vue')
        }
    ]
}

export default routes
