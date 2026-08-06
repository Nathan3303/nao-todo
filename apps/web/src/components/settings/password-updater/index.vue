<script setup lang="ts">
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/views/index/settings/context'
import { UserPasswordUpdater } from '@nao-todo/presentation-identity'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { t } from '@nao-todo/shared'
import { inject } from 'vue'
import { useRouter } from 'vue-router'

defineOptions({ name: 'SettingsPasswordUpdater' })

const router = useRouter()

const { isDisplayAside, switchDisplayAside, authUseCase, userUseCase } =
    inject(SETTINGS_VIEW_CONTEXT_KEY)!

/**
 * 修改密码成功后登出并返回登录页
 * @description 后端改密后旧 token 可能已失效，远程登出尽力而为；
 *              无论成败都清除本地会话并跳转登录页
 */
const handleSignOut = async () => {
    const token = localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY) ?? ''
    await authUseCase.signOut(token)
    await router.replace('/auth/signin')
}
</script>

<template>
    <nue-container>
        <nue-header>
            <nue-button
                :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                theme="icon,ghost"
                @click="switchDisplayAside"
            />
            <nue-text>{{ t('settings.password') }}</nue-text>
        </nue-header>
        <nue-main theme="password-updater">
            <nue-content fill>
                <nue-div vertical style="padding: 1rem">
                    <user-password-updater
                        style="max-width: 32rem"
                        :user-use-case="userUseCase"
                        @sign-out="handleSignOut"
                    />
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
.nue-main--password-updater {
    max-width: 24rem;
}
</style>