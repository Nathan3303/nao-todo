<script setup lang="ts">
import { AppFloatAside } from '@/layouts/app'
import SettingsAside from './aside.vue'
import { inject } from 'vue'
import type { SettingsViewContext } from '@/views/index/settings/settings-view'
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'

defineOptions({ name: 'SettingsAsideDrawer' })

const { isDisplayAside } = inject<SettingsViewContext>(SETTINGS_VIEW_CONTEXT_KEY)!
</script>

<template>
    <app-float-aside v-model="isDisplayAside">
        <settings-aside width="100%" />
    </app-float-aside>
</template>

