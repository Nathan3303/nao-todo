<script setup lang="ts">
import {
    TaskBasicInfo,
    TaskCheckButton,
    TaskDateInfo,
    TaskPriorityInfo,
    TaskStateInfo,
    type TaskColumnOptions
} from '@nao-todo/shared'
import { TaskTagBar } from '../../'
import { computed, inject } from 'vue'
import type { TaskKanbanColumnItemProps, TaskKanbanContext } from './types'
import { TASK_KANBAN_CONTEXT_KEY } from './use-kanban'

defineOptions({ name: 'TaskKanbanColumnItem' })
const props = defineProps<TaskKanbanColumnItemProps>()

const kanbanCtx = inject<TaskKanbanContext>(TASK_KANBAN_CONTEXT_KEY)

const isAttrsNone = computed(() => {
    if (!props.columns) return true
    let isNoColumnSelected = true
    for (const column in props.columns) {
        if (column === 'description') continue
        if (props.columns[column as keyof TaskColumnOptions]) {
            isNoColumnSelected = false
            break
        }
    }
    return isNoColumnSelected && !props.task.tags.length
})

const isDone = computed(() => props.task.state === 'done')

const handleClick = () => {
    if (kanbanCtx && !props.isUpdating) {
        kanbanCtx.showTaskDetails(props.task.id)
    }
}

const handleDelete = () => {
    if (kanbanCtx && !props.isUpdating) {
        kanbanCtx.deleteOrRestore(props.task.id, props.task.isDeleted)
    }
}

const handleFinish = () => {
    if (kanbanCtx && !props.isUpdating) {
        if (isDone.value) {
            kanbanCtx.unfinishTask(props.task.id)
        } else {
            kanbanCtx.finishTask(props.task.id)
        }
    }
}
</script>

<template>
    <nue-div
        v-if="kanbanCtx"
        class="todo-card"
        @click="handleClick"
        :data-is-done="isDone"
        :data-actived="actived"
        :data-is-deleted="task.isDeleted"
        :data-is-given-up="task.isGivenUp"
        :class="{ 'todo-card--updating': isUpdating }"
    >
        <nue-div vertical>
            <task-check-button :is-done="isDone" :is-updating="isUpdating" @change="handleFinish" />
        </nue-div>
        <nue-div vertical gap=".5rem" flex="1" overflow="hidden">
            <nue-div class="todo-card__info">
                <nue-div align="center">
                    <nue-text v-if="task.isGivenUp" class="todo-card__giveup-tag">已放弃</nue-text>
                    <nue-text class="todo-card__name" :clamped="1">{{ task.name }}</nue-text>
                    <nue-div class="todo-card__actions">
                        <nue-button
                            theme="pure"
                            :icon="task.isDeleted ? 'restore' : 'delete'"
                            @click.stop="handleDelete"
                            :disabled="isUpdating"
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
                <task-tag-bar
                    v-if="columns?.tags && task.tags.length"
                    :available-tags="tags"
                    :task-tag-ids="task.tags"
                    :clamped="3"
                    transform-origin="left"
                    readonly
                    small
                />
            </nue-div>
            <nue-div v-if="!isAttrsNone" class="todo-card__attrs">
                <task-date-info
                    v-if="columns?.createdAt"
                    :date="task.createdAt"
                    :formatter="(date) => `创建于${date}`"
                />
                <task-date-info
                    v-if="columns?.updatedAt"
                    :date="task.updatedAt"
                    :formatter="(date) => `修改于${date}`"
                />
                <task-date-info
                    v-if="columns?.endAt"
                    :date="task.endAt!"
                    :formatter="(date) => `截止于${date}`"
                    :colored="!isDone"
                />
                <task-state-info v-if="columns?.state" :state="task.state" />
                <task-priority-info v-if="columns?.priority" :priority="task.priority" />
                <task-basic-info
                    v-if="columns?.project"
                    icon="inbox-fill"
                    :text="kanbanCtx.getProjectName(task.projectId) || '收集箱'"
                />
            </nue-div>
        </nue-div>
    </nue-div>
</template>