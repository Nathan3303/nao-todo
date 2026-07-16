<script setup lang="ts">
import { inject, computed } from 'vue'
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
import { getColumnStyle } from './column-style'

defineOptions({ name: 'TaskTableMain' })

const tableCtx = inject<TaskTableContext>(TASK_TABLE_CONTEXT_KEY)!

const visibleColumns = computed(() => {
    return tableCtx.visibleColumns.value || []
})

const tasks = computed(() => {
    return tableCtx.tasks.value || []
})
</script>

<template>
    <nue-div v-if="tableCtx" class="todo-table__main">
        <nue-div
            v-for="(task, idx) in tasks"
            :key="task.id"
            :data-done="task.state === 'done'"
            :data-selected="tableCtx.isInMultiSelectRange(idx)"
            :data-deleted="task.isDeleted && !tableCtx.suppressDeletedStyle.value"
            class="todo-table__main__row"
            @click.stop.exact="tableCtx.showTaskDetails(task.id, idx)"
            @click.stop.shift.exact="tableCtx.showMultiSelectPanel(idx)"
        >
            <template v-for="column in visibleColumns" :key="column.key">
                <nue-div
                    v-if="column.key === 'name'"
                    class="todo-table__main__col col-first"
                    vertical
                    :style="getColumnStyle(column)"
                >
                    <nue-div class="col-first__name-wrapper">
                        <!-- 已放弃 -->
                        <nue-text
                            v-if="task.isGivenUp && !tableCtx.suppressGivenUpLabel.value"
                            theme="todo-givenup"
                            >已放弃</nue-text
                        >
                        <!-- 名称 -->
                        <nue-text theme="todo-name" :clamped="1" :title="task.name">
                            {{ task.name }}
                        </nue-text>
                        <!-- 标签 -->
                        <task-tag-bar
                            v-if="tableCtx.columns.value.tags && task.tags && task.tags.length"
                            :clamped="tableCtx.tagBarClamped.value"
                            :available-tags="tableCtx.tags.value"
                            :task-tag-ids="task.tags"
                            readonly
                            small
                        />
                    </nue-div>
                    <!-- 描述 -->
                    <nue-div
                        v-if="tableCtx.columns.value.description && task.description"
                        vertical
                        width="100%"
                    >
                        <nue-text
                            :clamped="1"
                            class="col-first__description"
                            :title="task.description"
                        >
                            {{ task.description }}
                        </nue-text>
                    </nue-div>
                </nue-div>
                <!-- 已放弃时间 -->
                <task-date-info
                    v-else-if="column.key === 'givenUpAt'"
                    class="todo-table__main__col col-datetime"
                    :date="task.givenUpAt || ''"
                    :style="getColumnStyle(column)"
                />
                <!-- 创建时间 -->
                <task-date-info
                    v-else-if="column.key === 'createdAt'"
                    class="todo-table__main__col col-datetime"
                    :date="task.createdAt"
                    :style="getColumnStyle(column)"
                />
                <!-- 更新时间 -->
                <task-date-info
                    v-else-if="column.key === 'updatedAt'"
                    class="todo-table__main__col col-datetime"
                    :date="task.updatedAt"
                    :style="getColumnStyle(column)"
                />
                <!-- 起始时间 -->
                <nue-div
                    v-else-if="column.key === 'startAt'"
                    class="todo-table__main__col col-datetime"
                    :style="getColumnStyle(column)"
                >
                    <nue-text v-if="task.startAt" :title="task.startAt">
                        {{ parse2RelativeDate(task.startAt) }}
                    </nue-text>
                    <nue-text v-else>未设置起始时间</nue-text>
                </nue-div>
                <!-- 结束时间 -->
                <task-date-info
                    v-else-if="column.key === 'endAt'"
                    class="todo-table__main__col col-datetime"
                    :date="task.endAt!"
                    :colored="!(task.state === 'done')"
                    :style="getColumnStyle(column)"
                />
                <!-- 优先级 -->
                <task-priority-info
                    v-else-if="column.key === 'priority'"
                    class="todo-table__main__col col-attr"
                    :key="task.priority"
                    :priority="task.priority"
                    use-clamped
                    :style="getColumnStyle(column)"
                />
                <!-- 状态 -->
                <task-state-info
                    v-else-if="column.key === 'state'"
                    class="todo-table__main__col col-attr"
                    :key="task.state"
                    :state="task.state"
                    use-clamped
                    :style="getColumnStyle(column)"
                />
                <!-- 所属清单 -->
                <task-basic-info
                    v-else-if="column.key === 'project'"
                    class="todo-table__main__col col-attr"
                    :text="tableCtx.getProjectName(task.projectId)"
                    no-icon
                    :style="getColumnStyle(column)"
                />
                <!-- 删除时间 -->
                <task-date-info
                    v-else-if="column.key === 'deletedAt'"
                    class="todo-table__main__col col-datetime"
                    :date="task.deletedAt!"
                    :style="getColumnStyle(column)"
                />
            </template>
            <nue-div class="todo-table__main__col col-actions">
                <nue-icon
                    :name="task.isDeleted ? 'restore' : 'delete'"
                    @click.stop="tableCtx.deleteOrRestore(task.id, task.isDeleted)"
                />
            </nue-div>
        </nue-div>
    </nue-div>
</template>

