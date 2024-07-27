<template>
    <nue-div
        class="todo-card"
        theme="card"
        :data-is-done="isDone"
        @click.stop="handleClick"
        :data-actived="actived"
    >
        <nue-div vertical width="fit-content" gap="0px">
            <nue-icon
                class="todo-card__check-icon"
                :name="checkIconName"
                @click.stop="handleFinish"
            ></nue-icon>
        </nue-div>
        <nue-div vertical gap="8px" flex>
            <nue-div class="todo-card__info">
                <nue-div align="center" gap="4px" justify="space-between">
                    <nue-text class="todo-card__name">{{ todo.name }}</nue-text>
                    <nue-div class="todo-card__actions">
                        <nue-button
                            theme="pure"
                            :icon="todo.isDeleted ? 'restore' : 'delete'"
                            @click.stop="handleDelete"
                        ></nue-button>
                    </nue-div>
                </nue-div>
                <nue-text class="todo-card__description" v-if="todo.description">
                    {{ todo.description }}
                </nue-text>
            </nue-div>
            <nue-div class="todo-card__attrs" align="center" gap="4px">
                <nue-div v-if="todo.dueDate.endAt" align="center" gap="4px">
                    <nue-icon name="calendar" color="gray"></nue-icon>
                    <nue-text size="12px" color="gray">
                        {{ moment(todo.dueDate.endAt).format('YYYY-MM-DD HH:mm') }}
                    </nue-text>
                </nue-div>
                <nue-div align="center" gap="4px">
                    <nue-icon name="inbox-fill" color="gray"></nue-icon>
                    <nue-text size="12px" color="gray">{{
                        todo.project?.title || '收集箱'
                    }}</nue-text>
                </nue-div>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import moment from 'moment'
import type { TodoCardEmits, TodoCardProps } from './types'

defineOptions({ name: 'TodoCard' })
const props = defineProps<TodoCardProps>()
const emit = defineEmits<TodoCardEmits>()

const isDone = computed(() => {
    const { isDone, state } = props.todo
    const _done = isDone || state === 'done'
    return _done
})

const checkIconName = computed(() => {
    return isDone.value ? 'square-check-fill' : 'square'
})

const handleClick = () => {
    const todoId = props.todo.id
    emit('click', todoId)
}

const handleDelete = () => {
    const { id: todoId, isDeleted } = props.todo
    if (isDeleted) {
        emit('restore', todoId)
    } else {
        emit('delete', todoId)
    }
}

const handleFinish = () => {
    const { id: todoId, isDone, state } = props.todo
    if (isDone || state === 'done') {
        emit('unfinish', todoId)
    } else {
        emit('finish', todoId)
    }
}
</script>

<style scoped>
@import url('./card.css');
</style>
