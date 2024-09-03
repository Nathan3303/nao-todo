<template>
    <nue-div class="todo-event-row">
        <nue-icon
            class="todo-event-row__check-icon"
            :name="iconName"
            size="16px"
            @click="handleUpdate(true)"
        ></nue-icon>
        <nue-input
            :key="event.id"
            theme="small,noshape"
            v-model="inputValue"
            @blur="handleUpdate(false)"
            :data-is-done="event.isDone"
        ></nue-input>
        <nue-div class="todo-event-row__actions">
            <nue-icon name="delete" color="red" @click="handleDelete"></nue-icon>
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

const iconName = computed(() => {
    return props.event.isDone ? 'square-check-fill' : 'square'
})

const handleUpdate = (updateIsDone = false) => {
    const { id, title, isDone } = props.event
    if (title === inputValue.value && !updateIsDone) return
    const _n_isDone = updateIsDone ? !isDone : isDone
    const payload = { id, title: inputValue.value, isDone: _n_isDone }
    emit('update', payload)
}

const handleDelete = () => {
    const { id } = props.event
    emit('delete', id)
}
</script>

<style scoped>
@import url('./event-row.css');
</style>
