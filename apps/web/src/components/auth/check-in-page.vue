<script setup lang="ts">
import { AUTH_VIEW_CONTEXT_KEY } from '@/views/auth/context'
import { AuthCheckIn } from '@nao-todo/domain/auth'
import { inject } from 'vue'

defineOptions({ name: 'AuthCheckInPage' })

const { authUseCase } = inject(AUTH_VIEW_CONTEXT_KEY)!
</script>

<template>
    <auth-check-in :auth-use-case="authUseCase" loading-text="正在验证用户凭据，请稍后 ..." />
</template>

