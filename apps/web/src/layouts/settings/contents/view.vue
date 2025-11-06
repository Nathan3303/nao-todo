<script setup lang="ts">
import { useSettingsViewStore } from '@/stores/settings'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { SettingsViewFloating, SettingsViewLandingPage } from '@/components/settings/view'

defineOptions({ name: 'SettingsView' })

const settingsViewStore = useSettingsViewStore()

const { isDisplayAside } = storeToRefs(settingsViewStore)

const hideAsideButtonIcon = computed(() => {
    return (isDisplayAside.value ? 'menu-close' : 'menu-open') as never
})
</script>

<template>
    <nue-container id="SettingsViewContainer">
        <nue-header>
            <nue-button
                :icon="hideAsideButtonIcon"
                theme="icon,ghost"
                @click="settingsViewStore.switchIsDisplayAside"
            />
            <nue-text>页面设置</nue-text>
        </nue-header>
        <nue-main>
            <nue-content fill>
                <nue-div vertical gap="1rem" style="padding: 1rem">
                    <settings-view-floating />
                    <settings-view-landing-page />
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>
