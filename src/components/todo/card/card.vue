<template>
    <nue-div class="todo-card" theme="card" wrap="nowrap" :data-is-done="isDone">
        <nue-icon
            class="todo-card__check-icon"
            :name="checkIconName"
            size="22px"
            color="lightgray"
        ></nue-icon>
        <nue-div vertical gap="8px" flex>
            <nue-text class="todo-card__name" size="15px">{{ todo.name }}</nue-text>
            <nue-text v-if="todo.description" size="12px" color="gray">
                {{ todo.description }}
            </nue-text>
            <nue-div align="center" gap="8px">
                <nue-div v-if="todo.dueDate.endAt" align="center" gap="4px" width="fit-content">
                    <nue-icon name="calendar" color="gray"></nue-icon>
                    <nue-text size="12px" color="gray">
                        {{ moment(todo.dueDate.endAt).format('YYYY-MM-DD') }}
                    </nue-text>
                </nue-div>
                <todo-priority-info :priority="todo.priority" colored></todo-priority-info>
                <nue-icon
                    v-if="todo.isPinned"
                    class="todo-card__favorite-icon"
                    name="heart-fill"
                ></nue-icon>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TodoCardProps } from './types'
import { TodoStateInfo, TodoPriorityInfo } from '@/components'
import moment from 'moment'

defineOptions({ name: 'TodoCard' })
const props = defineProps<TodoCardProps>()

const isDone = computed(() => {
    const { isDone, state } = props.todo
    const _done = isDone || state === 'done'
    return _done
})

const checkIconName = computed(() => {
    return isDone.value ? 'square-check-fill' : 'square'
})
</script>

<style scoped>
.todo-card {
    .todo-card__check-icon {
        cursor: pointer;
    }
    .todo-card__favorite-icon {
        --icon-color: #ee537f;
    }
}

.todo-card[data-is-done='true'] {
    .todo-card__check-icon {
        --icon-color: var(--primary-color);
    }
    .todo-card__name {
        text-decoration: line-through;
        color: gray;
    }
}
</style>
