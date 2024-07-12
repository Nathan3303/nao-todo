<template>
    <nue-div class="todo-event-row">
        <nue-icon
            class="todo-event-row__check-icon"
            :name="iconName"
            size="15px"
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
    const payload = { id, title, isDone: _n_isDone }
    emit('update', payload)
}

const handleDelete = () => {
    const { id } = props.event
    emit('delete', id)
}
</script>

<style scoped>
.todo-event-row {
    height: 28px;
    padding: 0px 1px;
    flex-wrap: nowrap;
    align-items: center;
    gap: 6px;

    .todo-event-row__check-icon {
        cursor: pointer;
    }

    .nue-input--small {
        font-size: var(--text-xs);
        padding: 0;
        flex: 1;

        &[data-is-done="true"] {
            text-decoration: line-through;
            color: var(--primary-disabled);
        }
    }

    .todo-event-row__actions {
        width: fit-content;
        display: none;

        & > .nue-icon {
            cursor: pointer;
        }
    }

    &:hover {
        /* background-color: #f5f5f5; */
        /* border-radius: var(--primary-radius); */
        box-shadow: 0px 1px rgba(0, 0, 0, 0.3);

        .todo-event-row__actions {
            display: flex;
        }
    }

    &:focus-within {
        /* background-color: #f5f5f5; */
        box-shadow: 0px 1px rgba(0, 0, 0, 0.3);
    }
}
</style>
