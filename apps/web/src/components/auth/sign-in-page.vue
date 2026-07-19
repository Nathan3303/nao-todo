<script setup lang="ts">
import { AUTH_VIEW_CONTEXT_KEY } from '@/views/auth/context'
import { AuthSignIn } from '@nao-todo/domain/auth'
import { inject } from 'vue'

defineOptions({ name: 'AuthSignInPage' })

const { authUseCase } = inject(AUTH_VIEW_CONTEXT_KEY)!
</script>

<template>
    <auth-sign-in :auth-use-case="authUseCase" />
</template>

