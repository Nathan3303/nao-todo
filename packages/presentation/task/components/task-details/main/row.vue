<script setup lang="ts">
defineOptions({ name: 'TodoDetailsRow' })
defineProps<{
    label: string
    text?: string | null
    flex?: string
}>()
</script>

<template>
    <nue-div vertical gap="4px" :flex="flex">
        <nue-text size="var(--nue-text-sm)" color="var(--nue-primary-color-500)">
            {{ label }}
        </nue-text>
        <slot>
            <nue-text size="var(--nue-text-sm)" color="var(--nue-primary-color-800)">
                {{ text || '暂无文本' }}
            </nue-text>
        </slot>
    </nue-div>
</template>