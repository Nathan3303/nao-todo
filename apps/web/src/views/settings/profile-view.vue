<template>
    <nue-container id="SettingsProfileViewContainer">
        <nue-header>
            <nue-text>设置 - 用户信息</nue-text>
        </nue-header>
        <nue-main>
            <nue-content fill>
                <nue-div vertical gap="2rem" style="padding: 2rem 1rem">
                    <settings-profile-avatar />
                    <settings-profile-nickname />
                    <settings-profile-info />
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import {
    SettingsProfileAvatar,
    SettingsProfileNickname,
    SettingsProfileInfo
} from '@/components/settings'

defineOptions({ name: 'SettingsProfileView' })
</script>
