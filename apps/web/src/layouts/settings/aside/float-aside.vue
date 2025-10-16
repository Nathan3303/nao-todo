<script setup lang="ts">
import { GlobalFloatAside } from '@/layouts/global'
import SettingsAside from './aside.vue'

defineOptions({ name: 'SettingsAsideDrawer' })
</script>

<template>
    <global-float-aside>
        <settings-aside width="100%" />
    </global-float-aside>
</template>
