import type { NavigationGuard, RouteRecordRaw } from 'vue-router'
import useAuthViewStore from './auth-view-store'

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
    // 1. 判断是否处于认证相关页面
    const toName = to.name as string
    if (toName?.startsWith('auth-')) {
        next()
        return
    }
    // 1. 判断是否登入
    const authViewStore = useAuthViewStore()
    if (authViewStore.authApp.states.isAuthenticated) return next()
    // 未登录，跳转到任务列表页
    // const err = await authViewStore.checkIn()
    // if (err) {
    //     NueMessage.error(unwrapError(err))
    //     next({ name: 'signin' })
    //     return
    // }
    next({
        name: 'auth-checkin',
        query: { fromUrl: from.fullPath }
    })
}

export default routes
export { beforeEnter }
