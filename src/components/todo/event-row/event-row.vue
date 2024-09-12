<template>
    <nue-div class="todo-event-row">
        <nue-icon
            class="todo-event-row__check-icon"
            :name="updateLoading ? 'loading' : iconName"
            :spin="updateLoading"
            size="16px"
            @click="handleUpdate(true)"
        />
        <nue-input
            :key="event.id"
            theme="small,noshape"
            v-model="inputValue"
            :data-is-done="event.isDone"
            :disabled="updateLoading"
            @blur="handleUpdate(false)"
        />
        <nue-div class="todo-event-row__actions">
            <nue-icon name="delete" :color="updateLoading ? 'gray' : 'red'" @click="handleDelete" />
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TodoEventRowEmits, TodoEventRowProps } from './types'

defineOptions({ name: 'TodoEventRow' })
const props = defineProps<TodoEventRowProps>()
const emit = defineEmits<TodoEventRowEmits>()

const inputValue = ref(props.event.title)
const updateLoading = ref(false)

const iconName = computed(() => {
    return props.event.isDone ? 'square-check-fill' : 'square'
})

const handleUpdate = async (updateIsDone = false) => {
    const { id, title, isDone } = props.event
    if (title === inputValue.value && !updateIsDone) return
    if (updateLoading.value) return
    const _n_isDone = updateIsDone ? !isDone : isDone
    const payload = { id, title: inputValue.value, isDone: _n_isDone }
    const { onUpdate } = props
    if (onUpdate) {
        updateLoading.value = true
        await onUpdate(payload)
        updateLoading.value = false
    } else {
        emit('update', payload)
    }
}

const handleDelete = async () => {
    const { id } = props.event
    if (updateLoading.value) return
    const { onDelete } = props
    if (onDelete) {
        updateLoading.value = true
        await onDelete(id)
        updateLoading.value = false
    } else {
        emit('delete', id)
    }
}
</script>

<style scoped>
@import url('./event-row.css');
</style>
