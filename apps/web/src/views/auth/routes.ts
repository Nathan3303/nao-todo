import type { RouteRecordRaw } from 'vue-router'
import useUserStore from '@/stores/user-store'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/infrastructure/consts/auth'

const routes: RouteRecordRaw = {
    path: '/auth',
    name: 'auth',
    props: true,
    component: () => import('./entry.vue'),
    children: [
        {
            path: 'signin',
            name: 'auth-signin',
            component: () => import('@/layouts/auth/content/sign-in.vue')
        },
        {
            path: 'signup',
            name: 'auth-signup',
            component: () => import('@/layouts/auth/content/sign-up.vue')
        },
        {
            path: 'checkin',
            name: 'auth-checkin',
            component: () => import('@/layouts/auth/content/check-in.vue')
        }
    ]
}

const beforeEnter = async () => {
    // 获取 LocalStorage 中的 JWT 令牌
    const jwt = localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)
    // 若有 JWT 令牌且未登录，跳转到检入页
    const userStore = useUserStore()
    if (jwt !== null && !userStore.isAuthenticated) return { name: 'auth-checkin' }
    // 若没有 JWT 令牌且未登录，跳转到登录页
    else if (jwt === null && !userStore.isAuthenticated) return { name: 'auth-signin' }
    // 若有 JWT 令牌且已登录，放行
    else if (jwt !== null && userStore.isAuthenticated) return true
    // 若没有 JWT 令牌且已登录，则跳转到检入页
    else return { name: 'auth-checkin' }
}

export default routes
export { beforeEnter }

