<script setup lang="ts">
/**
 * 设置「账户」分类中的密码修改（SHELL-05 / T535）
 * @description 复用 `presentation-identity` 的改密表单（保存/校验语义零改动）；改密成功后旧 token 可能
 *              已失效 ⇒ 远程登出尽力而为，无论成败都跳登录页（与 v1.12.16 逐字一致）。
 * @see docs/prds/2026-10-24-settings-ia.md（AC2 · AC5 零行为回归）
 */
import { inject } from 'vue'
import { useRouter } from 'vue-router'
import { UserPasswordUpdater } from '@nao-todo/presentation-identity'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { SETTINGS_VIEW_CONTEXT_KEY } from '../context'

defineOptions({ name: 'SettingsPasswordUpdater' })

const router = useRouter()

const { authUseCase, userUseCase } = inject(SETTINGS_VIEW_CONTEXT_KEY)!

/** 修改密码成功后登出并返回登录页 */
const handleSignOut = async () => {
    const token = localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY) ?? ''
    await authUseCase.signOut(token)
    await router.replace('/auth/signin')
}
</script>

<template>
    <user-password-updater
        class="settings-password"
        :user-use-case="userUseCase"
        @sign-out="handleSignOut"
    />
</template>

<style scoped>
.settings-password {
    display: block;
    max-width: 32rem;
}
</style>