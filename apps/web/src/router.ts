import { createRouter, createWebHashHistory } from 'vue-router'
import authRoutes, { beforeEnter as authBeforeEnter } from '@/views/auth/routes'
import indexRoutes from '@/views/index/routes'

const router = createRouter({
    history: createWebHashHistory(),
    routes: [authRoutes, { ...indexRoutes, beforeEnter: authBeforeEnter }]
})

export default router

