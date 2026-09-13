<script setup lang="ts">
import { AUTH_VIEW_CONTEXT_KEY } from '@/views/auth/context'
import { revokeOfflineEntry } from '@/views/auth/offline-entry'
import { LAST_VISITED_ROUTE_KEY } from '@/router'
import { safeReplaceDeepLink } from '@/safe-navigation'
import { AuthCheckIn } from '@nao-todo/presentation-identity'
import { inject } from 'vue'
import { useRouter } from 'vue-router'

defineOptions({ name: 'AuthCheckInPage' })

const router = useRouter()
const { authUseCase } = inject(AUTH_VIEW_CONTEXT_KEY)!

const handleCheckInSuccess = async () => {
    // SHELL-03 C-25：检入成功 ⇒ 清离线进入授权（显式清，不依赖 store 内部；守卫的 JWT 条件为兜底）
    revokeOfflineEntry()
    // C-35：统一封装（深链校验 + 回退 + 失效键清理 + 失败结构化记录）
    await safeReplaceDeepLink(
        router,
        [{ key: LAST_VISITED_ROUTE_KEY, value: localStorage.getItem(LAST_VISITED_ROUTE_KEY) }],
        '/tasks',
        'auth:check-in-navigation',
        localStorage
    )
}
</script>

<template>
    <auth-check-in
        :auth-use-case="authUseCase"
        loading-text="正在验证用户凭据，请稍后 ..."
        @check-in-success="handleCheckInSuccess"
    />
</template>