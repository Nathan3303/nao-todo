<script setup lang="ts">
import { useSettingsViewStore } from '@/stores/settings'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { SettingsPasswordForm } from '@/components/settings'

defineOptions({ name: 'SettingsPassword' })

const settingsViewStore = useSettingsViewStore()

const { isDisplayAside } = storeToRefs(settingsViewStore)

const hideAsideButtonIcon = computed(() => {
    return (isDisplayAside.value ? 'menu-close' : 'menu-open') as never
})
</script>

<template>
    <nue-container id="SettingsPasswordContainer">
        <nue-header>
            <nue-button
                :icon="hideAsideButtonIcon"
                theme="icon,ghost"
                @click="settingsViewStore.switchIsDisplayAside"
            />
            <nue-text>修改密码</nue-text>
        </nue-header>
        <nue-main>
            <nue-content fill style="padding: 1rem">
                <settings-password-form />
            </nue-content>
        </nue-main>
    </nue-container>
</template>
