<template>
    <nue-button theme="small" :icon="isDeleted ? 'restore' : 'delete'" @click="handleClick">
        {{ isDeleted ? '恢复任务' : '删除任务' }}
    </nue-button>
</template>

<script setup lang="ts">
defineOptions({ name: 'TodoDeleteButton' })
const props = defineProps<{
    isDeleted?: boolean
}>()
const emit = defineEmits<{
    (event: 'delete'): void
    (event: 'restore'): void
}>()

const handleClick = () => {
    if (props.isDeleted) {
        emit('restore')
    } else {
        emit('delete')
    }
}
</script>
