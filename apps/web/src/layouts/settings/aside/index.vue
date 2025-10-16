<script setup lang="ts">
import SettingsAside from './aside.vue'
import SettingsFloatAside from './float-aside.vue'
import { useSettingsViewStore } from '@/stores/settings'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'SettingsAsideWrapper' })

const settingsViewStore = useSettingsViewStore()

const { isDisplayAside, asideWidth, isUseFloatAside } = storeToRefs(settingsViewStore)
</script>

<template>
    <settings-float-aside v-if="isUseFloatAside" />
    <template v-else-if="isDisplayAside">
        <settings-aside :width="asideWidth" max-width="256px" min-width="180px" />
        <nue-separator op-target="previous" @resize="settingsViewStore.handleAsideResize" />
    </template>
</template>
