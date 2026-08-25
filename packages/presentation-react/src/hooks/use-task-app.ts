import { useEffect, useRef } from 'react'
import type { Requester } from '@nao-todo/shared/requester/types'
import {
    AuthStoreCore,
    BuiltInProjectStoreCore,
    ProjectStoreCore,
    TagStoreCore,
    TaskStoreCore,
    composeAuthUseCase,
    composeBuiltInProjectUseCase,
    composeProjectUseCase,
    composeTagUseCase,
    composeTaskUseCase,
    composeUserUseCase,
    loadStoredToken,
    navCore,
    type ComposedAuthUseCase,
    type ComposedBuiltInProjectUseCase,
    type ComposedProjectUseCase,
    type ComposedTagUseCase,
    type ComposedTaskUseCase,
    type ComposedUserUseCase
} from '../logic'
import { useAuthStore } from './use-auth-store'

export type UseTaskAppOptions = {
    /**
     * 请求器工厂
     * @description 由应用入口提供（配置层职责）；onAuthExpired 已接好「清空登录态」回调
     */
    createRequester: (onAuthExpired: () => void) => Requester
}

/**
 * 任务应用组合根（DI 唯一入口）
 * @description 单例装配全部业务依赖：认证/用户、任务（含检查项/评论）、项目、标签、内建清单；
 *              启动恢复登录态（checkIn）→ 拉取 profile → 载入内建清单与首屏数据；
 *              凭证失效回调清空登录态并回登录页。Views 层只消费返回值。
 */
export const useTaskApp = ({ createRequester }: UseTaskAppOptions) => {
    // 单例：存储与用例（useRef 惰性初始化）
    const refs = useRef<{
        authStore: AuthStoreCore
        taskStore: TaskStoreCore
        projectStore: ProjectStoreCore
        tagStore: TagStoreCore
        builtInProjectStore: BuiltInProjectStoreCore
        authUseCase: ComposedAuthUseCase
        userUseCase: ComposedUserUseCase
        taskUseCase: ComposedTaskUseCase
        projectUseCase: ComposedProjectUseCase
        tagUseCase: ComposedTagUseCase
        builtInProjectUseCase: ComposedBuiltInProjectUseCase
    } | null>(null)

    if (refs.current === null) {
        const authStore = new AuthStoreCore()
        const taskStore = new TaskStoreCore()
        const projectStore = new ProjectStoreCore()
        const tagStore = new TagStoreCore()
        const builtInProjectStore = new BuiltInProjectStoreCore()

        // requester 单例：凭证失效 → 清空登录态 + 回登录页
        const requester = createRequester(() => {
            authStore.clearAuthData()
            navCore.reset('task-list', { builtinId: 'today' })
        })

        refs.current = {
            authStore,
            taskStore,
            projectStore,
            tagStore,
            builtInProjectStore,
            authUseCase: composeAuthUseCase(requester, authStore),
            userUseCase: composeUserUseCase(requester, authStore),
            taskUseCase: composeTaskUseCase(requester, taskStore),
            projectUseCase: composeProjectUseCase(requester, projectStore),
            tagUseCase: composeTagUseCase(requester, tagStore),
            builtInProjectUseCase: composeBuiltInProjectUseCase(builtInProjectStore)
        }
    }

    const {
        authStore,
        taskStore,
        projectStore,
        tagStore,
        builtInProjectStore,
        authUseCase,
        userUseCase,
        taskUseCase,
        projectUseCase,
        tagUseCase,
        builtInProjectUseCase
    } = refs.current

    // 认证状态（useSyncExternalStore 响应 store 变化）
    const { isAuthenticated, userToken } = useAuthStore(authStore)

    // 启动：恢复登录态 → checkIn → profile + 内建清单 + 首屏
    useEffect(() => {
        void (async () => {
            const token = await loadStoredToken()
            if (!token) return
            const err = await authUseCase.checkIn(token)
            if (err !== null) return
            // 登录成功：拉取 profile（侧边栏用户区）；载入内建清单；默认进入「今日任务」
            void userUseCase.loadUserProfile()
            builtInProjectUseCase.loadBuiltInProjects()
            navCore.reset('task-list', { builtinId: 'today' })
        })()
    }, [authUseCase, userUseCase, builtInProjectUseCase])

    // 登录成功（token 变化且已认证）→ 拉取 profile + 内建清单 + 默认「今日任务」
    useEffect(() => {
        if (!isAuthenticated || !userToken) return
        void userUseCase.loadUserProfile()
        builtInProjectUseCase.loadBuiltInProjects()
        navCore.reset('task-list', { builtinId: 'today' })
    }, [isAuthenticated, userToken, userUseCase, builtInProjectUseCase])

    return {
        isAuthenticated,
        userToken,
        authStore,
        taskStore,
        projectStore,
        tagStore,
        builtInProjectStore,
        authUseCase,
        userUseCase,
        taskUseCase,
        projectUseCase,
        tagUseCase,
        builtInProjectUseCase,
        navCore
    }
}

export type TaskApp = ReturnType<typeof useTaskApp>