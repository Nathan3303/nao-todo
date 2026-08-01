<script setup lang="ts">
defineOptions({ name: 'DropdownDivBlock' })
defineProps<{ title: string }>()
</script>

<template>
    <nue-div theme="dropdown-div-block">
        <nue-text theme="dropdown-div-block__title" :clamped="1">{{ title }}</nue-text>
        <nue-text v-if="$slots.description" theme="dropdown-div-block__description" :clamped="2">
            <slot name="description"></slot>
        </nue-text>
        <slot></slot>
    </nue-div>
</template>

<style scoped>
.nue-div--dropdown-div-block {
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    margin-top: var(--nue-padding-2xs);
    user-select: none;
    -webkit-user-select: none;

    > .nue-text--dropdown-div-block__title {
        color: var(--nue-primary-color-600);
        font-size: var(--nue-text-sm);
        margin-left: var(--nue-padding-xs);
        line-height: 2;
    }

    > .nue-text--dropdown-div-block__description {
        color: var(--nue-primary-color-500);
        font-size: var(--nue-text-xs);
        margin-left: var(--nue-padding-xs);
        margin-top: -6px;
    }
}
</style>