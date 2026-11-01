<script setup lang="ts">
import { TaskBasicInfo } from '@nao-todo/shared/components/task-basic-info'
import { TaskCheckButton } from '@nao-todo/shared/components/task-check-button'
import { TaskDateInfo } from '@nao-todo/shared/components/task-date-info'
import { TaskPriorityInfo } from '@nao-todo/shared/components/task-priority-info'
import { TaskStateInfo } from '@nao-todo/shared/components/task-state-info'
import { TaskTagBar } from '../../'
import { computed, inject } from 'vue'
import type { TaskKanbanColumnItemProps, TaskKanbanContext } from './types'
import { TASK_KANBAN_CONTEXT_KEY } from './use-kanban'

defineOptions({ name: 'TaskKanbanColumnItem' })
const props = defineProps<TaskKanbanColumnItemProps>()

const { showTaskDetails, deleteOrRestore, unfinishTask, finishTask, getProjectName } =
    inject<TaskKanbanContext>(TASK_KANBAN_CONTEXT_KEY)!

/**
 * 是否渲染属性区
 * @description 判据必须与模板 `.todo-card__attrs` 内的 6 个子项**同源**（`DEF-127`）：
 *              只勾标签 / 其它非属性维度时，属性区会渲染成空盒子并吃掉父级 `gap`。
 */
const hasCardAttrs = computed(
    () =>
        !!props.columns?.createdAt ||
        !!props.columns?.updatedAt ||
        !!props.columns?.endAt ||
        !!props.columns?.state ||
        !!props.columns?.priority ||
        !!props.columns?.project
)

const isDone = computed(() => props.task.state === 'done')

const handleClick = () => {
    if (props.isUpdating) return
    showTaskDetails(props.task.id)
}

const handleDelete = () => {
    if (props.isUpdating) return
    deleteOrRestore(props.task.id, props.task.isDeleted)
}

const handleFinish = () => {
    if (props.isUpdating) return
    if (isDone.value) {
        unfinishTask(props.task.id)
    } else {
        finishTask(props.task.id)
    }
}
</script>

<template>
    <nue-div
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
                    <nue-div class="todo-card__name-cell">
                        <nue-text class="todo-card__name" :clamped="1">{{ task.name }}</nue-text>
                        <!-- 星标 -->
                        <nue-icon
                            v-if="task.isStarMarked"
                            class="todo-card__star"
                            name="heart-fill"
                        />
                    </nue-div>
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
            <nue-div v-if="hasCardAttrs" class="todo-card__attrs">
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
                    :text="getProjectName(task.projectId) || '收集箱'"
                />
            </nue-div>
        </nue-div>
    </nue-div>
</template>