<script setup lang="ts">
import {
    SettingsProfileAvatar,
    SettingsProfileNickname,
    SettingsProfileInfo
} from '@/components/settings'
import { inject } from 'vue'
import { t } from '@nao-todo/infrastructure/locales'
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/views/index/settings/context'

defineOptions({ name: 'SettingsProfile' })

const { isDisplayAside, switchDisplayAside } = inject(SETTINGS_VIEW_CONTEXT_KEY)!
</script>

<template>
    <nue-container id="SettingsProfileContainer">
        <nue-header>
            <nue-button
                :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                theme="icon,ghost"
                @click="switchDisplayAside"
            />
            <nue-text>{{ t('settings.profile') }}</nue-text>
        </nue-header>
        <nue-main>
            <nue-content fill>
                <nue-div vertical style="padding: 2rem 1rem">
                    <settings-profile-avatar />
                    <settings-profile-nickname />
                    <settings-profile-info />
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

