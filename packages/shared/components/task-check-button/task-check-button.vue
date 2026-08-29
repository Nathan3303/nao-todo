<template>
    <nue-button
        theme="pure,icon,chkbtn"
        :size="size"
        :icon="iconName"
        :loading="isUpdating"
        :disabled="isUpdating"
        :style="priorityColor ? { '--nue-button-color': priorityColor } : undefined"
        @click="handleClick"
        @mouseover="isHover = true"
        @mouseout="isHover = false"
    />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TaskCheckButtonProps, TaskCheckButtonEmits } from './types'

defineOptions({ name: 'TaskCheckButton', inheritAttrs: false })
const props = defineProps<TaskCheckButtonProps>()
const emit = defineEmits<TaskCheckButtonEmits>()

const isHover = ref(false)

const iconName = computed(() => {
    return isHover.value ? 'square-check' : props.isDone ? 'square-check-fill' : 'square'
})

const handleClick = (e: Event) => {
    e.stopPropagation()
    emit('change', !props.isDone)
}
</script>

<style scoped>
.nue-button--chkbtn {
    --nue-button-font-size: 1.25rem;
    --nue-button-color: var(--nue-primary-color-800);
    cursor: pointer;

    &.nue-button--small {
        --nue-button-font-size: 1.125rem;
    }

    &.nue-button--large {
        --nue-button-font-size: 1.375rem;
    }
}
</style>