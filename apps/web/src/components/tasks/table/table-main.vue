<script setup lang="ts">
import { inject } from 'vue'
import {
    TodoPriorityInfo,
    TodoStateInfo,
    TodoTagBar,
    TodoDateInfo,
    TodoBasicInfo
} from '@nao-todo/components'
import { useRelativeDate } from '@nao-todo/hooks'
import { TASK_TABLE_CONTEXT_KEY } from './use-table'
import type { TaskTableContext } from './types'

defineOptions({ name: 'TaskTableMain' })

const tableContext = inject<TaskTableContext>(TASK_TABLE_CONTEXT_KEY)
</script>

<template>
    <nue-div v-if="tableContext" class="todo-table__main">
        <nue-div
            v-for="(task, idx) in tableContext.tasks.value"
            :key="task.id"
            :data-done="task.state === 'done'"
            :data-selected="tableContext.isInMultiSelectRange(idx)"
            :data-deleted="task.isDeleted"
            :data-giveup="task.isGivenUp"
            class="todo-table__main__row"
            @click.stop.exact="tableContext.showTaskDetails(task.id, idx)"
            @click.stop.shift.exact="tableContext.showMultiSelectPanel(idx)"
        >
            <nue-div class="todo-table__main__col col-first" vertical>
                <nue-div class="col-first__name-wrapper">
                    <nue-text theme="todo-name" :clamped="1" :title="task.name">
                        {{ task.name }}
                    </nue-text>
                    <todo-tag-bar
                        v-if="tableContext.columns.value.tags && task.tags.length"
                        :clamped="tableContext.tagBarClamped.value"
                        :tags="tableContext.tags.value"
                        :todoTags="task.tags"
                        readonly
                        small
                    />
                </nue-div>
                <nue-div
                    v-if="tableContext.columns.value.description && task.description"
                    vertical
                    width="100%"
                >
                    <nue-text :clamped="2" class="col-first__description" :title="task.description">
                        {{ task.description }}
                    </nue-text>
                </nue-div>
            </nue-div>
            <todo-date-info
                v-if="tableContext.columns.value.createdAt"
                class="todo-table__main__col col-datetime"
                :date="task.createdAt"
            />
            <todo-date-info
                v-if="tableContext.columns.value.updatedAt"
                class="todo-table__main__col col-datetime"
                :date="task.updatedAt"
            />
            <nue-div
                v-if="tableContext.columns.value.startAt"
                class="todo-table__main__col col-datetime"
            >
                <nue-text v-if="task.startAt" :title="task.startAt">
                    {{ useRelativeDate(task.startAt) }}
                </nue-text>
                <nue-text v-else>未设置起始时间</nue-text>
            </nue-div>
            <todo-date-info
                v-if="tableContext.columns.value.endAt"
                class="todo-table__main__col col-datetime"
                :date="task.endAt!"
                :colored="!(task.state === 'done')"
            />
            <todo-priority-info
                v-if="tableContext.columns.value.priority"
                class="todo-table__main__col col-attr"
                :key="task.priority"
                :priority="task.priority"
                use-clamped
            />
            <todo-state-info
                v-if="tableContext.columns.value.state"
                class="todo-table__main__col col-attr"
                :key="task.state"
                :state="task.state"
                use-clamped
            />
            <todo-basic-info
                v-if="tableContext.columns.value.project"
                class="todo-table__main__col col-attr"
                :text="tableContext.getProjectName(task.projectId)"
                no-icon
            />
            <nue-div class="todo-table__main__col col-actions">
                <slot :task="task" name="row-actions">
                    <nue-icon
                        :name="task.isDeleted ? 'restore' : 'delete'"
                        @click.stop="tableContext.deleteOrRestore(task.id, task.isDeleted)"
                    />
                </slot>
            </nue-div>
        </nue-div>
    </nue-div>
</template>
