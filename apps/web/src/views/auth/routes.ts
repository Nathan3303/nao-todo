import type { RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@nao-todo/presentation-identity'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { cryptoService, localSession, resolveUserIdFromStoredJwt } from '@nao-todo/infrastructure'
import { isOfflineEntryGranted } from './offline-entry'

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
            component: () => import('@/components/auth/sign-in-page.vue')
        },
        {
            path: 'signup',
            name: 'auth-signup',
            component: () => import('@/components/auth/sign-up-page.vue')
        },
        {
            path: 'checkin',
            name: 'auth-checkin',
            component: () => import('@/components/auth/check-in-page.vue')
        }
    ]
}

// @typedef AuthViewRoutesBeforeEnter 身份验证视图路由守卫
const beforeEnter = async () => {
    // SHELL-03 附录 B-2 / C-22：离线进入放行（四条件**全为本地事实**；任一不满足 ⇒ 落回下方既有三分支）
    // ① 用户本会话显式授予（会话级内存 flag，不落盘）
    // ② JWT 存在且可解析出 userId  ③ 内存会话与 JWT 同一用户（解锁门已置位）
    // ④ 本地保险库已解锁（= 用户已输入密码）
    // 禁用项：不得用 navigator.onLine（网通但服务端不可达时不可靠）、不得用昵称缓存（C-19 明文禁参与守卫）
    if (isOfflineEntryGranted()) {
        const jwtUserId = resolveUserIdFromStoredJwt()
        const sessionUserId = localSession.getCurrentUserId()
        if (
            jwtUserId !== null &&
            sessionUserId === jwtUserId &&
            cryptoService.isUnlocked === true
        ) {
            return true
        }
    }
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