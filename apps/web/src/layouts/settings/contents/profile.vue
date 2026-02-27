<script setup lang="ts">
import {
    SettingsProfileAvatar,
    SettingsProfileNickname,
    SettingsProfileInfo
} from '@/components/settings'
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { SettingsViewContext } from '@/views/index/settings/settings-view'
import { inject } from 'vue'

defineOptions({ name: 'SettingsProfile' })

const { isDisplayAside, switchDisplayAside } =
    inject<SettingsViewContext>(SETTINGS_VIEW_CONTEXT_KEY)!
</script>

<template>
    <nue-container id="SettingsProfileContainer">
        <nue-header>
            <nue-button
                :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                theme="icon,ghost"
                @click="switchDisplayAside"
            />
            <nue-text>用户信息</nue-text>
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

