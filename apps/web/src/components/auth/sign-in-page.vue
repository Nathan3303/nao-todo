<script setup lang="ts">
import { AUTH_VIEW_CONTEXT_KEY } from '@/views/auth/context'
import { LAST_VISITED_ROUTE_KEY } from '@/router'
import { safeReplaceDeepLink } from '@/safe-navigation'
import { AuthSignIn } from '@nao-todo/presentation-identity'
import { inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'

defineOptions({ name: 'AuthSignInPage' })

const router = useRouter()
const route = useRoute()
const { authUseCase } = inject(AUTH_VIEW_CONTEXT_KEY)!

/** 显式深链目标（DEF-59 / R3：`query.redirect` > `LAST_VISITED_ROUTE`；非法值由候选链跳过） */
const deepLinkTarget = (): string | null => {
    const redirect = route.query.redirect
    return typeof redirect === 'string' ? redirect : null
}

const onSignInSuccess = () => {
    // C-35：统一封装（深链校验 + 回退 + 失效键清理 + 失败结构化记录）
    void safeReplaceDeepLink(
        router,
        [
            { value: deepLinkTarget() },
            { key: LAST_VISITED_ROUTE_KEY, value: localStorage.getItem(LAST_VISITED_ROUTE_KEY) }
        ],
        '/tasks',
        'auth:sign-in-navigation',
        localStorage
    )
}
</script>

<template>
    <auth-sign-in :auth-use-case="authUseCase" @sign-in-success="onSignInSuccess" />
</template>