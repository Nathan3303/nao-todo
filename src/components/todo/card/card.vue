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
            />
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
                        />
                    </nue-div>
                </nue-div>
                <nue-text
                    v-if="todo.description && columns?.description"
                    class="todo-card__description"
                    :clamped="3"
                >
                    {{ todo.description }}
                </nue-text>
            </nue-div>
            <nue-div class="todo-card__attrs" align="center" gap="6px">
                <nue-div class="todo-card__infos" align="center" gap="6px">
                    <todo-tag-bar
                        v-if="todo.tags.length"
                        :tags="tagStore.tags"
                        :todoTags="todo.tags"
                        :clamped="3"
                        readonly
                        small
                    />
                    <todo-state-info v-if="columns?.state" :state="todo.state" />
                    <todo-priority-info v-if="columns?.priority" :priority="todo.priority" />
                </nue-div>
                <nue-div v-if="columns?.endAt" align="center" gap="4px">
                    <nue-icon name="calendar" color="gray" />
                    <nue-text size="12px" :color="isTodoExpired(todo) ? '#ec5555' : 'gray'">
                        {{ useRelativeDate(todo.dueDate.endAt) }}
                    </nue-text>
                </nue-div>
                <nue-div v-if="columns?.project" align="center" gap="4px">
                    <nue-icon name="inbox-fill" color="gray" />
                    <nue-text size="12px" color="gray">
                        {{ todo.project?.title || '收集箱' }}
                    </nue-text>
                </nue-div>
                <nue-div v-if="columns?.createdAt" align="center" gap="4px">
                    <nue-icon name="time" color="gray" />
                    <nue-text size="12px" color="gray">
                        创建于 {{ useRelativeDate(todo.createdAt) }}
                    </nue-text>
                </nue-div>
                <nue-div v-if="columns?.updatedAt" align="center" gap="4px">
                    <nue-icon name="time" color="gray" />
                    <nue-text size="12px" color="gray">
                        最后修改于 {{ useRelativeDate(todo.updatedAt) }}
                    </nue-text>
                </nue-div>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRelativeDate } from '@/hooks/use-relative-date'
import { TodoStateInfo } from '../state-info'
import { TodoPriorityInfo } from '../priority-info'
import { TodoTagBar } from '../tag-bar'
import moment from 'moment'
import type { TodoCardEmits, TodoCardProps } from './types'
import type { Todo } from '@/stores'

defineOptions({ name: 'TodoCard' })
const props = defineProps<TodoCardProps>()
const emit = defineEmits<TodoCardEmits>()

import { useTagStore } from '@/stores'
const tagStore = useTagStore()

const isDone = computed(() => {
    const { isDone, state } = props.todo
    const _done = isDone || state === 'done'
    return _done
})

const checkIconName = computed(() => {
    return isDone.value ? 'square-check-fill' : 'square'
})

const isTodoExpired = (todo: Todo) => {
    const endAt = todo.dueDate.endAt
    if (!endAt || todo.state === 'done' || todo.isDone) return false
    const date = moment(endAt)
    return date.isBefore(moment())
}

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
