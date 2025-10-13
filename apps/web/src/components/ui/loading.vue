<template>
    <nue-div align="center" justify="center" style="padding: 16px">
        <nue-icon name="loading" size="18px" spin />
        <nue-text size="12px" color="gray">{{ placeholder || '正在加载...' }}</nue-text>
    </nue-div>
</template>

<script setup lang="ts">
defineOptions({ name: 'Loading' })
defineProps<{
    loading?: boolean
    placeholder?: string
}>()
</script>
