<script setup lang="ts">
import { AUTH_VIEW_CONTEXT_KEY } from '@/views/auth/context'
import { AuthSignIn } from '@nao-todo/presentation-identity'
import { inject } from 'vue'
import { useRouter } from 'vue-router'

defineOptions({ name: 'AuthSignInPage' })

const router = useRouter()
const { authUseCase } = inject(AUTH_VIEW_CONTEXT_KEY)!

const onSignInSuccess = () => {
    router.replace(localStorage.getItem('LAST_VISITED_ROUTE') || '/tasks')
}
</script>

<template>
    <auth-sign-in :auth-use-case="authUseCase" @sign-in-success="onSignInSuccess" />
</template>