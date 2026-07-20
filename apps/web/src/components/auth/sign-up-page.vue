<script setup lang="ts">
import { AUTH_VIEW_CONTEXT_KEY } from '@/views/auth/context'
import { AuthSignUp } from '@nao-todo/presentation/auth'
import { inject } from 'vue'

defineOptions({ name: 'AuthSignUpPage' })

const { authUseCase } = inject(AUTH_VIEW_CONTEXT_KEY)!
</script>

<template>
    <auth-sign-up :auth-use-case="authUseCase" />
</template>

