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
    width: fit-content;
    flex: none;
    color: var(--nue-primary-color-800);
    font-size: var(--nue-text-sm);

    > .nue-icon {
        font-size: 1.25em;
        line-height: 1;
    }
}
</style>