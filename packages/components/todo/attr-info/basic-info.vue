<script setup lang="ts">
defineOptions({ name: 'TodoBasicInfo' })
withDefaults(
    defineProps<{
        icon?: string
        text?: string
        clamped?: number
        noIcon?: boolean
    }>(),
    { icon: 'more2' }
)
</script>

<template>
    <nue-div theme="basic-info">
        <nue-icon v-if="!noIcon" :name="icon" />
        <nue-text :clamped="clamped">{{ text }}</nue-text>
    </nue-div>
</template>

<style scoped>
.nue-div.nue-div--basic-info {
    align-items: center;
    gap: 0.25rem;
    flex-wrap: nowrap;
    color: var(--nue-primary-color-700);
    width: auto;

    > .nue-icon {
        --nue-icon-size: var(--nue-text-df);
    }

    > .nue-text {
        font-size: var(--nue-text-xs);
    }
}
</style>
