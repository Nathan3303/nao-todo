<script setup lang="ts">
import { AUTH_VIEW_CONTEXT_KEY } from '@/views/auth/context'
import { useUserStore } from '@nao-todo/presentation'
import { AuthSignIn } from '@nao-todo/presentation/auth'
import { inject } from 'vue'
import { useRouter } from 'vue-router'

defineOptions({ name: 'AuthSignInPage' })

const router = useRouter()
const { authUseCase } = inject(AUTH_VIEW_CONTEXT_KEY)!

const userStore = useUserStore()

const onSignInSuccess = () => {
    const deletionDeadline = userStore.getDeletionDeadline()
    if (!deletionDeadline || localStorage.getItem('CONFIRM_UNRESTORE')) {
        router.replace(localStorage.getItem('LAST_VISITED_ROUTE') || '/tasks')
        return
    }
    router.push('/user/restore')
}
</script>

<template>
    <auth-sign-in :auth-use-case="authUseCase" @sign-in-success="onSignInSuccess" />
</template>
