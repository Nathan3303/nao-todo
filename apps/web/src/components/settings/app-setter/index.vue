<script setup lang="ts">
import { UserThemeSetter, UserLanguageSetter } from '@nao-todo/domain/user'
import { inject } from 'vue'
import { t } from '@nao-todo/shared'
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/views/index/settings/context'

defineOptions({ name: 'SettingsApp' })

const { isDisplayAside, switchDisplayAside, userUseCase } = inject(SETTINGS_VIEW_CONTEXT_KEY)!
</script>

<template>
    <nue-container id="SettingsAppContainer">
        <nue-header>
            <nue-button
                :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                theme="icon,ghost"
                @click="switchDisplayAside"
            />
            <nue-text>{{ t('settings.app') }}</nue-text>
        </nue-header>
        <nue-main>
            <nue-content fill>
                <nue-div vertical style="padding: 1rem">
                    <user-language-setter />
                    <nue-divider />
                    <user-theme-setter :user-use-case="userUseCase" />
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
.nue-divider {
    margin: 1rem 0;
}
</style>
