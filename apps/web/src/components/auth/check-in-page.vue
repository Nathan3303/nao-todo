<script setup lang="ts">
import { AUTH_VIEW_CONTEXT_KEY } from '@/views/auth/context'
import { revokeOfflineEntry } from '@/views/auth/offline-entry'
import { AuthCheckIn } from '@nao-todo/presentation-identity'
import { inject } from 'vue'
import { useRouter } from 'vue-router'

defineOptions({ name: 'AuthCheckInPage' })

const router = useRouter()
const { authUseCase } = inject(AUTH_VIEW_CONTEXT_KEY)!

const handleCheckInSuccess = async () => {
    // SHELL-03 C-25：检入成功 ⇒ 清离线进入授权（显式清，不依赖 store 内部；守卫的 JWT 条件为兜底）
    revokeOfflineEntry()
    const err = await router.replace(localStorage.getItem('LAST_VISITED_ROUTE') || '/tasks')
    if (err) router.replace('/tasks')
}
</script>

<template>
    <auth-check-in
        :auth-use-case="authUseCase"
        loading-text="正在验证用户凭据，请稍后 ..."
        @check-in-success="handleCheckInSuccess"
    />
</template>