<template>
    <nue-div align="center" flex gap="8px">
        <nue-icon :name="icon" size="18px"></nue-icon>
        <nue-text size="16px"> {{ title }} </nue-text>
        <nue-text style="margin-left: auto"> {{ count || 0 }} </nue-text>
    </nue-div>
</template>

<script setup lang="ts">
import type { StateOverviewRowProps } from './types'

defineProps<StateOverviewRowProps>()
</script>

<style scoped></style>
