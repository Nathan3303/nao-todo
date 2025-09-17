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
            component: () => import('./sign-in.vue')
        },
        {
            path: 'signup',
            name: 'signup',
            component: () => import('./sign-up.vue')
        }
    ]
}

export default routes
