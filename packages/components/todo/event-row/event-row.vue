<template>
    <nue-div class="todo-event-row">
        <nue-icon
            class="todo-event-row__check-icon"
            :name="updateLoading ? 'loading' : event.isDone ? 'square-check-fill' : 'square'"
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
            <nue-icon name="delete" :color="updateLoading ? 'gray' : '#ff6f6f'" @click="handleDelete" />
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { TodoEventRowEmits, TodoEventRowProps } from './types'

defineOptions({ name: 'TodoEventRow' })
const props = defineProps<TodoEventRowProps>()
const emit = defineEmits<TodoEventRowEmits>()

const inputValue = ref(props.event.title)
const updateLoading = ref(false)

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
.todo-event-row {
    height: 28px;
    padding: 0 1px;
    flex-wrap: nowrap;
    align-items: center;
    gap: 6px;
}

.todo-event-row__check-icon {
    cursor: pointer;
}

.todo-event-row .nue-input--small {
    --disabled-background-color: transparent;
    font-size: var(--text-xs);
    padding: 0;
    flex: 1;
}

.todo-event-row .nue-input--small[data-is-done='true'] {
    text-decoration: line-through;
    color: #999;
}

.todo-event-row__actions {
    width: fit-content;
    display: none;

    @media (max-width: 445px) {
        display: block;
    }
}

.todo-event-row__actions .nue-icon {
    cursor: pointer;
}

.todo-event-row:hover {
    box-shadow: 0 1px rgba(0, 0, 0, 0.3);
}

.todo-event-row:hover .todo-event-row__actions {
    display: flex;
}

.todo-event-row:focus-within {
    box-shadow: 0 1px rgba(0, 0, 0, 0.3);
}
</style>
