<script setup lang="ts">
import { AUTH_VIEW_CONTEXT_KEY } from '@/views/auth/context'
import { AuthCheckIn } from '@nao-todo/presentation/auth'
import { inject } from 'vue'
import { useRouter } from 'vue-router'

defineOptions({ name: 'AuthCheckInPage' })

const router = useRouter()
const { authUseCase } = inject(AUTH_VIEW_CONTEXT_KEY)!

const handleCheckInSuccess = async () => {
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
