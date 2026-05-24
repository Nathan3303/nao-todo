<script setup lang="ts">
import { computed } from 'vue'
import type { TaskDeleteButtonProps, TaskDeleteButtonEmits } from './types'

defineOptions({ name: 'TaskDeleteButton', inheritAttrs: false })
const props = defineProps<TaskDeleteButtonProps>()
const emit = defineEmits<TaskDeleteButtonEmits>()

const buttonIcon = computed(() => {
    return props.isDeleted ? 'restore' : 'delete'
})

const buttonText = computed(() => {
    return props.isDeleted ? '恢复任务' : '删除任务'
})

const handleClick = () => {
    if (props.isDeleted) {
        return emit('restore')
    }
    emit('delete')
}
</script>

<template>
    <nue-button theme="small" :size="size" :icon="buttonIcon" @click="handleClick">
        {{ buttonText }}
    </nue-button>
</template>
