<template>
    <nue-div vertical align="stretch" gap="4px" :flex="flex">
        <nue-text size="12px" color="gray">
            {{ label }}
        </nue-text>
        <slot>
            <nue-text size="12px">
                {{ text }}
            </nue-text>
        </slot>
    </nue-div>
</template>

<script setup lang="ts">
defineProps<{
    label: string
    text?: string | number
    flex?: string
}>()
</script>

<style scoped></style>
