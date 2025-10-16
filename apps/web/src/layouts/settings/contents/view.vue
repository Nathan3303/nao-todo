<script setup lang="ts">
import { useSettingsViewStore } from '@/stores/settings'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { SettingsViewFloating } from '@/components/settings/view'

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
            <nue-div flex="1" wrap="nowrap" align="center">
                <nue-button
                    :icon="hideAsideButtonIcon"
                    theme="icon,ghost"
                    @click="settingsViewStore.switchIsDisplayAside"
                />
                <nue-text size="var(--nue-text-xxl)">页面设置</nue-text>
            </nue-div>
        </nue-header>
        <nue-main>
            <nue-content fill>
                <nue-div vertical gap="2rem" style="padding: 2rem 1rem">
                    <settings-view-floating />
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
#SettingsViewContainer {
    height: 100%;

    > .nue-header,
    > .nue-main {
        border: none;
    }
}
</style>
