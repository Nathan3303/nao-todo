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
import { TASK_KANBAN_CONTEXT_KEY } from './use-kanban'
import type {
    TaskKanbanColumnItemProps,
    TaskKanbanColumnItemEmits,
    TaskKanbanContext
} from './types'
import type { TodoColumnOptions } from '@nao-todo/types'

defineOptions({ name: 'TaskKanbanColumnItem' })
const props = defineProps<TaskKanbanColumnItemProps>()
const emit = defineEmits<TaskKanbanColumnItemEmits>()

const kanbanCtx = inject<TaskKanbanContext>(TASK_KANBAN_CONTEXT_KEY)

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
    return isNoColumnSelected && !props.task.tags.length
})

const isDone = computed(() => props.task.state === 'done')


const handleClick = () => {
    const taskId = props.task.id
    emit('click', taskId)
}

const handleDelete = () => {
    const { id: taskId, isDeleted } = props.task
    if (isDeleted) {
        emit('restore', taskId)
    } else {
        emit('delete', taskId)
    }
}

const handleFinish = () => {
    if (isDone.value) {
        emit('unfinish', props.task.id)
    } else {
        emit('finish', props.task.id)
    }
}
</script>

<template>
    <nue-div
        v-if="kanbanCtx"
        class="todo-card"
        auto-fit
        @click="handleClick"
        :data-is-done="isDone"
        :data-actived="actived"
        :data-is-deleted="task.isDeleted"
    >
        <nue-div vertical>
            <todo-check-button :is-done="isDone" @change="handleFinish" size="large" />
        </nue-div>
        <nue-div vertical gap=".5rem" flex="1" overflow="hidden">
            <nue-div class="todo-card__info">
                <nue-div align="center">
                    <nue-text class="todo-card__name" :clamped="1">{{ task.name }}</nue-text>
                    <nue-div class="todo-card__actions">
                        <nue-button
                            theme="pure"
                            :icon="task.isDeleted ? 'restore' : 'delete'"
                            @click.stop="handleDelete"
                        />
                    </nue-div>
                </nue-div>
                <nue-text
                    v-if="task.description && columns?.description"
                    class="todo-card__description"
                    :clamped="2"
                >
                    {{ task.description }}
                </nue-text>
            </nue-div>
            <nue-div v-if="!isAttrsNone" vertical gap=".25rem">
                <nue-div vertical gap=".25rem">
                    <todo-tag-bar
                        v-if="columns?.tags && task.tags.length"
                        :tags="tags"
                        :todoTags="task.tags"
                        :clamped="2"
                        transform-origin="left"
                        readonly
                        small
                    />
                    <nue-div>
                        <todo-state-info v-if="columns?.state" :state="task.state" />
                        <todo-priority-info v-if="columns?.priority" :priority="task.priority" />
                    </nue-div>
                </nue-div>
                <nue-div gap=".25rem .5rem">
                    <todo-date-info
                        v-if="columns?.createdAt"
                        :date="task.createdAt"
                        :formatter="(date) => `创建于 ${date}`"
                    />
                    <todo-date-info
                        v-if="columns?.updatedAt"
                        :date="task.updatedAt"
                        :formatter="(date) => `修改于 ${date}`"
                    />
                    <todo-date-info
                        v-if="columns?.endAt"
                        :date="task.endAt!"
                        :formatter="(date) => `截止于 ${date}`"
                        :colored="!isDone"
                    />
                </nue-div>
                <nue-div gap=".25rem">
                    <todo-basic-info
                        v-if="columns?.project"
                        icon="inbox-fill"
                        :text="kanbanCtx.getProjectName(task.projectId) || '收集箱'"
                    />
                </nue-div>
            </nue-div>
        </nue-div>
    </nue-div>
</template>
