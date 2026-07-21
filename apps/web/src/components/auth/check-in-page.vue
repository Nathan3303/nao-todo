<script setup lang="ts">
import { AUTH_VIEW_CONTEXT_KEY } from '@/views/auth/context'
import { useUserStore } from '@nao-todo/presentation'
import { AuthCheckIn } from '@nao-todo/presentation/auth'
import { inject } from 'vue'
import { useRouter } from 'vue-router'

defineOptions({ name: 'AuthCheckInPage' })

const router = useRouter()
const { authUseCase } = inject(AUTH_VIEW_CONTEXT_KEY)!

const userStore = useUserStore()

const handleCheckInSuccess = () => {
    const deletionDeadline = userStore.getDeletionDeadline()
    if (!deletionDeadline || localStorage.getItem('CONFIRM_UNRESTORE')) {
        router.replace(localStorage.getItem('LAST_VISITED_ROUTE') || '/tasks')
        return
    }
    router.push('/user/restore')
}
</script>

<template>
    <auth-check-in
        :auth-use-case="authUseCase"
        loading-text="正在验证用户凭据，请稍后 ..."
        @check-in-success="handleCheckInSuccess"
    />
</template>
