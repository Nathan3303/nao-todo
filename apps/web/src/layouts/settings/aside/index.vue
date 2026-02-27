<script setup lang="ts">
import { inject } from 'vue'
import SettingsAside from './aside.vue'
import type { SettingsViewContext } from '@/views/index/settings/settings-view'
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import SettingsFloatAside from './float-aside.vue'

defineOptions({ name: 'SettingsAsideWrapper' })

const { asideWidth, isDisplayAside, isUseFloatAside, handleResizeAside } =
    inject<SettingsViewContext>(SETTINGS_VIEW_CONTEXT_KEY)!
</script>

<template>
    <settings-float-aside v-if="isUseFloatAside" />
    <template v-else-if="isDisplayAside">
        <settings-aside :width="asideWidth" max-width="256px" min-width="180px" />
        <nue-separator op-target="previous" @resize="handleResizeAside" />
    </template>
</template>

