<script setup lang="ts">
import { computed } from 'vue'
import type { NueButtonSize } from 'nue-ui'

type DeleteButtonProps = {
    isDeleted?: boolean
    size?: NueButtonSize
}
type DeleteButtonEmits = {
    (event: 'delete'): void
    (event: 'restore'): void
}

defineOptions({ name: 'TodoDeleteButton', inheritAttrs: false })
const props = defineProps<DeleteButtonProps>()
const emit = defineEmits<DeleteButtonEmits>()

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

