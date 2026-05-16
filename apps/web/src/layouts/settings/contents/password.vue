<script setup lang="ts">
import { SettingsPasswordForm } from '@/components/settings'
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { SettingsViewContext } from '@/views/index/settings/settings-view'
import { inject } from 'vue'
import { t } from '@nao-todo/infrastructure/locales'

defineOptions({ name: 'SettingsPassword' })

const { isDisplayAside, switchDisplayAside } =
    inject<SettingsViewContext>(SETTINGS_VIEW_CONTEXT_KEY)!
</script>

<template>
    <nue-container id="SettingsPasswordContainer">
        <nue-header>
            <nue-button
                :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                theme="icon,ghost"
                @click="switchDisplayAside"
            />
            <nue-text>{{ t('settings.password') }}</nue-text>
        </nue-header>
        <nue-main>
            <nue-content fill>
                <nue-div vertical style="padding: 1rem">
                    <settings-password-form style="max-width: 32rem" />
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

