<script setup lang="ts">
import useApp from './app'

defineOptions({ name: 'AppView' })

useApp()
</script>

<template>
    <router-view />
</template>
