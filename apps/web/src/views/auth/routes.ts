import type { RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@nao-todo/domain/user'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain/auth'

// @typedef AuthViewRoutes 身份验证视图路由
const routes: RouteRecordRaw = {
    path: '/auth',
    name: 'auth',
    props: true,
    component: () => import('./entry.vue'),
    children: [
        {
            path: 'signin',
            name: 'auth-signin',
            component: () => import('@nao-todo/domain/auth/components/sign-in.vue')
        },
        {
            path: 'signup',
            name: 'auth-signup',
            component: () => import('@nao-todo/domain/auth/components/sign-up.vue')
        },
        {
            path: 'checkin',
            name: 'auth-checkin',
            component: () => import('@nao-todo/domain/auth/components/check-in.vue')
        }
    ]
}

// @typedef AuthViewRoutesBeforeEnter 身份验证视图路由守卫
const beforeEnter = async () => {
    // 获取 LocalStorage 中的 JWT 令牌
    const jwt = localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)
    // 若有 JWT 令牌且未登录，跳转到检入页
    const userStore = useUserStore()
    if (jwt !== null && !userStore.getIsAuthenticated()) return { name: 'auth-checkin' }
    // 若没有 JWT 令牌且未登录，跳转到登录页
    else if (jwt === null && !userStore.getIsAuthenticated()) return { name: 'auth-signin' }
    // 若有 JWT 令牌且已登录，放行
    else if (jwt !== null && userStore.getIsAuthenticated()) return true
    // 若没有 JWT 令牌且已登录，则跳转到检入页
    else return { name: 'auth-checkin' }
}

export default routes
export { beforeEnter }
