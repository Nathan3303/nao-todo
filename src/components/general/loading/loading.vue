<template>
    <nue-div align="center" justify="center" style="padding: 16px">
        <nue-icon name="loading" size="18px" spin></nue-icon>
        <nue-text size="12px" color="gray">{{ placeholder || '正在加载...' }}</nue-text>
    </nue-div>
</template>

<script setup lang="ts">
import type { LoadingProps } from './types'

defineOptions({ name: 'Loading' })
defineProps<LoadingProps>()
</script>

<style scoped></style>
