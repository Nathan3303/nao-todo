<script setup lang="ts">
import { computed, inject } from 'vue'
import {
    TaskStateInfo,
    TaskPriorityInfo,
    TaskDateInfo,
    TaskBasicInfo,
    TaskTagBar,
    TaskCheckButton
} from '@nao-todo/components'
import { TASK_KANBAN_CONTEXT_KEY } from './use-kanban'
import type {
    TaskKanbanColumnItemProps,
    TaskKanbanContext
} from './types'
import type { TaskColumnOptions } from '@nao-todo/types'

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
    if (kanbanCtx) {
        kanbanCtx.showTaskDetails(props.task.id)
    }
}

const handleDelete = () => {
    if (kanbanCtx) {
        kanbanCtx.deleteOrRestore(props.task.id, props.task.isDeleted)
    }
}

const handleFinish = () => {
    if (kanbanCtx) {
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
        auto-fit
        @click="handleClick"
        :data-is-done="isDone"
        :data-actived="actived"
        :data-is-deleted="task.isDeleted"
    >
        <nue-div vertical>
            <task-check-button :is-done="isDone" @change="handleFinish" size="large" />
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
                    <task-tag-bar
                        v-if="columns?.tags && task.tags.length"
                        :tags="tags"
                        :task-tags="task.tags"
                        :clamped="2"
                        transform-origin="left"
                        readonly
                        small
                    />
                    <nue-div>
                        <task-state-info v-if="columns?.state" :state="task.state" />
                        <task-priority-info v-if="columns?.priority" :priority="task.priority" />
                    </nue-div>
                </nue-div>
                <nue-div gap=".25rem .5rem">
                    <task-date-info
                        v-if="columns?.createdAt"
                        :date="task.createdAt"
                        :formatter="(date) => `创建于 ${date}`"
                    />
                    <task-date-info
                        v-if="columns?.updatedAt"
                        :date="task.updatedAt"
                        :formatter="(date) => `修改于 ${date}`"
                    />
                    <task-date-info
                        v-if="columns?.endAt"
                        :date="task.endAt!"
                        :formatter="(date) => `截止于 ${date}`"
                        :colored="!isDone"
                    />
                </nue-div>
                <nue-div gap=".25rem">
                    <task-basic-info
                        v-if="columns?.project"
                        icon="inbox-fill"
                        :text="kanbanCtx.getProjectName(task.projectId) || '收集箱'"
                    />
                </nue-div>
            </nue-div>
        </nue-div>
    </nue-div>
</template>
