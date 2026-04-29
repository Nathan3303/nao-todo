<script setup lang="ts">
defineOptions({ name: 'DropdownDivBlock' })
defineProps<{ title: string }>()
</script>

<template>
    <nue-div theme="block">
        <nue-text theme="title">{{ title }}</nue-text>
        <slot></slot>
    </nue-div>
</template>

<style scoped>
.nue-div--block {
    flex-direction: column;
    gap: var(--nue-gap-xs);
    width: 100%;
    font-size: var(--nue-text-sm);
    user-select: none;
    -webkit-user-select: none;

    > .nue-text--title {
        font-weight: 500;
        color: var(--nue-primary-color-500);
        padding: var(--nue-padding-xs) 0;
    }
}
</style>

