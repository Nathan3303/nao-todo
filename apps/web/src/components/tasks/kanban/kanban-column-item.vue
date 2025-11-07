<script setup lang="ts">
import { computed, inject } from 'vue'
import {
    TodoStateInfo,
    TodoPriorityInfo,
    TodoDateInfo,
    TodoBasicInfo,
    TodoTagBar,
    TodoCheckButton
} from '@nao-todo/components'
import { TODO_KANBAN_CONTEXT_KEY } from './constants'
import type {
    TodoKanbanColumnItemProps,
    TodoKanbanColumnItemEmits,
    TodoKanbanContext
} from './types'
import type { TodoColumnOptions } from '@nao-todo/types'

defineOptions({ name: 'TodoKanbanColumnItem' })
const props = defineProps<TodoKanbanColumnItemProps>()
const emit = defineEmits<TodoKanbanColumnItemEmits>()

// @inject 看板组件上下文
const todoKanbanContext = inject<TodoKanbanContext>(TODO_KANBAN_CONTEXT_KEY)

const isAttrsNone = computed(() => {
    if (!props.columns) return true
    let isNoColumnSelected = true
    for (const column in props.columns) {
        if (column === 'description') continue
        if (props.columns[column as keyof TodoColumnOptions]) {
            isNoColumnSelected = false
            break
        }
    }
    return isNoColumnSelected && !props.todo.tags.length
})

const isDone = computed(() => props.todo.state === 'done')

const deleteIconName = computed(() => (props.todo.isDeleted ? 'restore' : 'delete') as never)

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
    if (isDone.value) {
        emit('unfinish', props.todo.id)
    } else {
        emit('finish', props.todo.id)
    }
}
</script>

<template>
    <nue-div
        class="todo-card"
        auto-fit
        @click="handleClick"
        :data-is-done="isDone"
        :data-actived="actived"
        :data-is-deleted="todo.isDeleted"
    >
        <nue-div vertical>
            <todo-check-button :is-done="isDone" @change="handleFinish" size="large" />
        </nue-div>
        <nue-div vertical gap=".5rem" flex="1" overflow="hidden">
            <nue-div class="todo-card__info">
                <nue-div align="center">
                    <nue-text class="todo-card__name" :clamped="1">{{ todo.name }}</nue-text>
                    <nue-div class="todo-card__actions">
                        <nue-button
                            theme="pure"
                            :icon="deleteIconName"
                            @click.stop="handleDelete"
                        />
                    </nue-div>
                </nue-div>
                <nue-text
                    v-if="todo.description && columns?.description"
                    class="todo-card__description"
                    :clamped="2"
                >
                    {{ todo.description }}
                </nue-text>
            </nue-div>
            <nue-div v-if="!isAttrsNone" vertical gap=".25rem">
                <nue-div vertical gap=".25rem">
                    <todo-tag-bar
                        v-if="columns?.tags && todo.tags.length"
                        :tags="tags"
                        :todoTags="todo.tags"
                        :clamped="2"
                        transform-origin="left"
                        readonly
                        small
                    />
                    <nue-div>
                        <todo-state-info v-if="columns?.state" :state="todo.state" />
                        <todo-priority-info v-if="columns?.priority" :priority="todo.priority" />
                    </nue-div>
                </nue-div>
                <nue-div gap=".25rem .5rem">
                    <todo-date-info
                        v-if="columns?.createdAt"
                        :date="todo.createdAt"
                        :formatter="(date) => `创建于 ${date}`"
                    />
                    <todo-date-info
                        v-if="columns?.updatedAt"
                        :date="todo.updatedAt"
                        :formatter="(date) => `修改于 ${date}`"
                    />
                    <todo-date-info
                        v-if="columns?.endAt"
                        :date="todo.endAt!"
                        :formatter="(date) => `截止于 ${date}`"
                        :colored="!isDone"
                    />
                </nue-div>
                <nue-div gap=".25rem">
                    <todo-basic-info
                        v-if="columns?.project"
                        icon="inbox-fill"
                        :text="todoKanbanContext?.getProjectName(todo.projectId) || '收集箱'"
                    />
                </nue-div>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

