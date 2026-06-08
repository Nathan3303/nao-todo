<script setup lang="ts">
import { FeatureUnimplement } from '@nao-todo/components'

defineOptions({ name: 'PomodoroFocus' })
</script>

<template>
    <feature-unimplement @back="$router.back()" />
</template>

<style scoped></style>

