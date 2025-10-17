<script setup lang="ts">
import { useSettingsViewStore } from '@/stores/settings'
import { storeToRefs } from 'pinia'
import {
    SettingsProfileAvatar,
    SettingsProfileNickname,
    SettingsProfileInfo,
    SettingsPasswordForm
} from '@/components/settings'
import { computed } from 'vue'

defineOptions({ name: 'SettingsProfile' })

const settingsViewStore = useSettingsViewStore()

const { isDisplayAside } = storeToRefs(settingsViewStore)

const hideAsideButtonIcon = computed(() => {
    return (isDisplayAside.value ? 'menu-close' : 'menu-open') as never
})
</script>

<template>
    <nue-container id="SettingsProfileContainer">
        <nue-header>
            <nue-button
                :icon="hideAsideButtonIcon"
                theme="icon,ghost"
                @click="settingsViewStore.switchIsDisplayAside"
            />
            <nue-text>用户信息</nue-text>
        </nue-header>
        <nue-main>
            <nue-content fill>
                <nue-div vertical style="padding: 2rem 1rem">
                    <settings-profile-avatar />
                    <settings-profile-nickname />
                    <settings-profile-info />
                    <settings-password-form />
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>
