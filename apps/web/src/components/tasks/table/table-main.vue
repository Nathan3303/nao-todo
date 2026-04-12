<script setup lang="ts">
import { inject } from 'vue'
import {
    TaskPriorityInfo,
    TaskStateInfo,
    TaskTagBar,
    TaskDateInfo,
    TaskBasicInfo
} from '@nao-todo/components'
import { parse2RelativeDate } from '@nao-todo/infrastructure/utils/relative-date-parser'
import { TASK_TABLE_CONTEXT_KEY } from './use-table'
import type { TaskTableContext } from './types'

defineOptions({ name: 'TaskTableMain' })

const tableCtx = inject<TaskTableContext>(TASK_TABLE_CONTEXT_KEY)
</script>

<template>
    <nue-div v-if="tableCtx" class="todo-table__main">
        <nue-div
            v-for="(task, idx) in tableCtx.tasks.value"
            :key="task.id"
            :data-done="task.state === 'done'"
            :data-selected="tableCtx.isInMultiSelectRange(idx)"
            :data-deleted="task.isDeleted"
            :data-giveup="task.isGivenUp"
            class="todo-table__main__row"
            @click.stop.exact="tableCtx.showTaskDetails(task.id, idx)"
            @click.stop.shift.exact="tableCtx.showMultiSelectPanel(idx)"
        >
            <nue-div class="todo-table__main__col col-first" vertical>
                <nue-div class="col-first__name-wrapper">
                    <nue-text theme="todo-name" :clamped="1" :title="task.name">
                        {{ task.name }}
                    </nue-text>
                    <task-tag-bar
                        v-if="tableCtx.columns.value.tags && task.tags && task.tags.length"
                        :clamped="tableCtx.tagBarClamped.value"
                        :tags="tableCtx.tags.value"
                        :task-tags="task.tags"
                        readonly
                        small
                    />
                </nue-div>
                <nue-div
                    v-if="tableCtx.columns.value.description && task.description"
                    vertical
                    width="100%"
                >
                    <nue-text :clamped="2" class="col-first__description" :title="task.description">
                        {{ task.description }}
                    </nue-text>
                </nue-div>
            </nue-div>
            <task-date-info
                v-if="tableCtx.columns.value.createdAt"
                class="todo-table__main__col col-datetime"
                :date="task.createdAt"
            />
            <task-date-info
                v-if="tableCtx.columns.value.updatedAt"
                class="todo-table__main__col col-datetime"
                :date="task.updatedAt"
            />
            <nue-div
                v-if="tableCtx.columns.value.startAt"
                class="todo-table__main__col col-datetime"
            >
                <nue-text v-if="task.startAt" :title="task.startAt">
                    {{ parse2RelativeDate(task.startAt) }}
                </nue-text>
                <nue-text v-else>未设置起始时间</nue-text>
            </nue-div>
            <task-date-info
                v-if="tableCtx.columns.value.endAt"
                class="todo-table__main__col col-datetime"
                :date="task.endAt!"
                :colored="!(task.state === 'done')"
            />
            <task-priority-info
                v-if="tableCtx.columns.value.priority"
                class="todo-table__main__col col-attr"
                :key="task.priority"
                :priority="task.priority"
                use-clamped
            />
            <task-state-info
                v-if="tableCtx.columns.value.state"
                class="todo-table__main__col col-attr"
                :key="task.state"
                :state="task.state"
                use-clamped
            />
            <task-basic-info
                v-if="tableCtx.columns.value.project"
                class="todo-table__main__col col-attr"
                :text="tableCtx.getProjectName(task.projectId)"
                no-icon
            />
            <nue-div class="todo-table__main__col col-actions">
                <slot :task="task" name="row-actions">
                    <nue-icon
                        :name="task.isDeleted ? 'restore' : 'delete'"
                        @click.stop="tableCtx.deleteOrRestore(task.id, task.isDeleted)"
                    />
                </slot>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

