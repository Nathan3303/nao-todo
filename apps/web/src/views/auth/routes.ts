import type { NavigationGuard, RouteRecordRaw } from 'vue-router'
import useUserStore from '@/stores/user-store'

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

const beforeEnter: NavigationGuard = async (to, from, next) => {
    // 用户凭证验证失败或者用户未登录，跳转到登录页
    // 判断是否处于认证相关页面
    const toName = to.name as string
    if (toName?.startsWith('auth-')) return next()
    // 判断是否登入
    const userStore = useUserStore()
    if (userStore.isAuthenticated) return next()
    // 未登录，跳转到任务列表页
    next({ name: 'auth-checkin' })
}

export default routes
export { beforeEnter }

