<template>
    <nue-div align="center" justify="center" style="padding: 16px;height: 100%">
        <nue-icon name="loading" size="1rem" spin />
        <nue-text size="0.75rem" color="gray">
            {{ placeholder || '正在加载...' }}
        </nue-text>
    </nue-div>
</template>

<script setup lang="ts">
defineOptions({ name: 'Loading' })
defineProps<{ loading?: boolean; placeholder?: string }>()
</script>
