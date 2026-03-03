<template>
    <nue-div align="center" justify="center" height="100%" style="padding: 16px">
        <nue-icon name="loading" size="1rem" spin />
        <nue-text size="0.75rem" color="gray">
            {{ placeholder || '正在加载...' }}
        </nue-text>
    </nue-div>
</template>

<script setup lang="ts">
import type { LoadingProps } from './types'

defineOptions({ name: 'Loading' })
defineProps<LoadingProps>()
</script>
