<script setup lang="ts">
import { ref } from 'vue'
import type { EventRowProps, EventRowEmits } from './types'

defineOptions({ name: 'EventRow' })
const props = defineProps<EventRowProps>()
const emit = defineEmits<EventRowEmits>()

const inputValue = ref(props.event.name)
const updateLoading = ref(false)

const handleUpdateIsDone = () => {
    if (updateLoading.value) return
    updateLoading.value = true
    props
        .onUpdate(props.event.id, { isDone: !props.event.isDone })
        .finally(() => (updateLoading.value = false))
}

const handleUpdateName = () => {
    if (updateLoading.value) return
    if (inputValue.value === props.event.name) return
    updateLoading.value = true
    props
        .onUpdate(props.event.id, { name: inputValue.value })
        .finally(() => (updateLoading.value = false))
}

const handleDelete = () => {
    if (updateLoading.value) return
    updateLoading.value = true
    props.onDelete(props.event.id).finally(() => (updateLoading.value = false))
}
</script>

<template>
    <nue-div theme="event-row">
        <nue-icon theme="drag-icon" name="more-vertical" draggable="true" />
        <nue-icon
            theme="pointer"
            :name="updateLoading ? 'loading' : event.isDone ? 'square-check-fill' : 'square'"
            :spin="updateLoading"
            @click="handleUpdateIsDone"
        />
        <nue-input
            :key="event.id"
            theme="small,pure"
            v-model="inputValue"
            :data-is-done="event.isDone"
            :disabled="updateLoading"
            @blur="handleUpdateName"
        />
        <nue-div theme="actions">
            <nue-icon
                name="plus-circle"
                title="依据该检查事项创建新任务"
                theme="pointer"
                @click="emit('toTask', event.id)"
            />
            <nue-icon
                name="delete"
                title="删除事件"
                theme="pointer"
                :color="updateLoading ? 'gray' : '#ff6f6f'"
                @click="handleDelete"
            />
        </nue-div>
    </nue-div>
</template>

<style scoped>
@import './row.css';
</style>

