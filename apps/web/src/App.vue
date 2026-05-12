<script setup lang="ts">
import useApp from './app'

defineOptions({ name: 'AppView' })

const { getUserLocalThemeMode } = useApp()

getUserLocalThemeMode()
</script>

<template>
    <router-view />
</template>

