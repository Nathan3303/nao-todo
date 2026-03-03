<script setup lang="ts">
import type { TaskBasicInfoProps } from './types'

defineOptions({ name: 'TaskBasicInfo' })
withDefaults(defineProps<TaskBasicInfoProps>(), { icon: 'more2', clamped: 1 })
</script>

<template>
    <nue-div theme="basic-info" :title="text">
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
