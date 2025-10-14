<script setup lang="ts">
defineOptions({ name: 'TodoDetailsRow' })
defineProps<{
    label: string
    text?: string | number
    flex?: string
}>()
</script>

<template>
    <nue-div vertical align="stretch" gap="4px" :flex="flex">
        <nue-text size="var(--nue-text-xs)" color="var(--nue-primary-color-500)">
            {{ label }}
        </nue-text>
        <slot>
            <nue-text size="var(--nue-text-xs)" color="var(--nue-primary-color-800)">
                {{ text }}
            </nue-text>
        </slot>
    </nue-div>
</template>
