<script setup lang="ts">
import {
    SettingsProfileAvatar,
    SettingsProfileNickname,
    SettingsProfileInfo,
    // SettingsPasswordForm
} from '@/components/settings'

defineOptions({ name: 'SettingsProfile' })
</script>

<template>
    <nue-container id="SettingsProfileContainer">
        <nue-header>
            <!-- <nue-button
                :icon="hideAsideButtonIcon"
                theme="icon,ghost"
                @click="settingsViewStore.switchIsDisplayAside"
            /> -->
            <nue-text>用户信息</nue-text>
        </nue-header>
        <nue-main>
            <nue-content fill>
                <nue-div vertical style="padding: 2rem 1rem">
                    <settings-profile-avatar />
                    <settings-profile-nickname />
                    <settings-profile-info />
                    <!-- <settings-password-form /> -->
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

