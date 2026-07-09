<script setup lang="ts">
import { SettingsAppAppereance, SettingsAppLanguage } from '@/components/settings'
import { inject } from 'vue'
import { t } from '@nao-todo/infrastructure/locales'
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/views/index/settings/context'

defineOptions({ name: 'SettingsApp' })

const { isDisplayAside, switchDisplayAside } = inject(SETTINGS_VIEW_CONTEXT_KEY)!
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
                    <settings-app-language />
                    <nue-divider />
                    <settings-app-appereance />
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

