<script setup lang="ts">
type TodoBasicInfoProps = {
    icon?: string
    text?: string
    clamped?: number
    noIcon?: boolean
}

defineOptions({ name: 'TodoBasicInfo' })
withDefaults(defineProps<TodoBasicInfoProps>(), { icon: 'more2', clamped: 1 })
</script>

<template>
    <nue-div theme="basic-info">
        <nue-icon v-if="!noIcon" :name="icon" />
        <nue-text :clamped="clamped">{{ text }}</nue-text>
    </nue-div>
</template>

<style scoped>
.nue-div--basic-info {
    align-items: center;
    gap: 0.25rem;
    flex-wrap: nowrap;
    color: var(--nue-primary-color-800);
    width: fit-content;
    flex: none;

    > .nue-icon {
        --nue-icon-size: var(--nue-text-md);
    }

    > .nue-text {
        font-size: var(--nue-text-sm);
    }
}
</style>

