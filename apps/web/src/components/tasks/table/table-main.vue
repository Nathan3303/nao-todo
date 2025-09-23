<template>
    <nue-div class="todo-table__main">
        <nue-empty v-if="!todos.length" description="当前列表无待办任务" />
        <template v-else>
            <nue-div
                v-for="(todo, idx) in todos"
                :key="todo.id + refreshKey"
                :data-done="todo.state === 'done'"
                :data-selected="idx >= selectRange.start && idx <= selectRange.end"
                :data-deleted="useDeletedLine && todo.isDeleted"
                :data-giveup="todo.isGivenUp"
                class="todo-table__main__row"
                @click.stop.exact="handleShowDetails(todo.id, idx)"
                @click.stop.shift.exact="handleMultiSelect(idx)"
            >
                <nue-div class="todo-table__main__col col-first" vertical>
                    <nue-div align="center" gap="0.5rem" wrap="nowrap">
                        <nue-div class="col-first__name" width="auto" gap=".5rem" align="center">
                            <span class="col-first__giveup-tag" v-if="todo.isGivenUp">已放弃</span>
                            <nue-text :clamped="1">{{ todo.name }}</nue-text>
                        </nue-div>
                        <todo-tag-bar
                            :clamped="tagBarClamped"
                            :tags="tags"
                            :todoTags="todo.tags"
                            readonly
                            small
                        />
                    </nue-div>
                    <nue-div v-if="columnOptions.description && todo.description" vertical>
                        <nue-text
                            :clamped="2"
                            class="col-first__description"
                            :title="todo.description"
                        >
                            {{ todo.description }}
                        </nue-text>
                    </nue-div>
                </nue-div>
                <nue-div v-if="columnOptions.createdAt" class="todo-table__main__col col-datetime">
                    <nue-text :title="todo.createdAt">
                        {{ useRelativeDate(todo.createdAt) }}
                    </nue-text>
                </nue-div>
                <nue-div v-if="columnOptions.updatedAt" class="todo-table__main__col col-datetime">
                    <nue-text :title="todo.updatedAt">
                        {{ useRelativeDate(todo.updatedAt) }}
                    </nue-text>
                </nue-div>
                <nue-div v-if="columnOptions.startAt" class="todo-table__main__col col-datetime">
                    <nue-text v-if="todo.startAt" :title="todo.startAt">
                        {{ useRelativeDate(todo.startAt) }}
                    </nue-text>
                    <nue-text v-else>未设置起始时间</nue-text>
                </nue-div>
                <nue-div
                    v-if="columnOptions.endAt"
                    :data-expired="isTodoExpired(todo)"
                    class="todo-table__main__col col-datetime"
                >
                    <nue-text v-if="todo.endAt" :title="todo.endAt">
                        {{ useRelativeDate(todo.endAt) }}
                    </nue-text>
                </nue-div>
                <nue-div v-if="columnOptions.priority" class="todo-table__main__col col-attr">
                    <todo-priority-info
                        :key="todo.priority"
                        :priority="todo.priority"
                        use-clamped
                    />
                </nue-div>
                <nue-div v-if="columnOptions.state" class="todo-table__main__col col-attr">
                    <todo-state-info :key="todo.state" :state="todo.state" use-clamped />
                </nue-div>
                <nue-div v-if="columnOptions.project" class="todo-table__main__col col-attr">
                    <nue-text
                        :clamped="1"
                        size="12px"
                        :title="getProjectNameByIdFromLocal(todo.projectId)"
                    >
                        {{
                            todo.project?.name ||
                            getProjectNameByIdFromLocal(todo.projectId) ||
                            '收集箱'
                        }}
                    </nue-text>
                </nue-div>
                <nue-div class="todo-table__main__col col-actions">
                    <slot :todo="todo" name="row-actions">
                        <nue-icon
                            :name="todo.isDeleted ? 'restore' : 'delete'"
                            @click.stop="handleDeleteBtnClk(todo.id, todo.isDeleted)"
                        />
                    </slot>
                </nue-div>
            </nue-div>
        </template>
    </nue-div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { TodoPriorityInfo, TodoStateInfo, TodoTagBar } from '@nao-todo/components'
import { useRelativeDate } from '@nao-todo/hooks'
import type { TodoTableContext } from './types'
import { todoTableContextKey } from './constants'

defineOptions({ name: 'TodoTableMain' })

const {
    columnOptions,
    todos,
    selectRange,
    useDeletedLine,
    tagBarClamped,
    tags,
    refreshKey,
    isTodoExpired,
    handleShowDetails,
    handleMultiSelect,
    getProjectNameByIdFromLocal,
    handleDeleteBtnClk
} = inject<TodoTableContext>(todoTableContextKey)!
</script>

<style scoped></style>
