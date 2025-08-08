<template>
    <nue-div class="todo-table__main">
        <slot v-if="!todos.length" name="empty">
            <nue-text class="todo-table__main__empty-text">当前列表无待办任务！</nue-text>
        </slot>
        <nue-div
            v-for="(todo, idx) in todos"
            v-else
            :key="todo.id"
            :data-done="todo.state === 'done'"
            :data-selected="idx >= selectRange.start && idx <= selectRange.end"
            :data-deleted="useDeletedLine && todo.isDeleted"
            :data-giveup="todo.isGivenUp"
            class="todo-table__main__row"
            @click.stop.exact="handleShowDetails(todo.id, idx)"
            @click.stop.shift.exact="handleMultiSelect(idx)"
        >
            <nue-div class="todo-table__main__col col-name" vertical>
                <nue-div align="center" wrap="nowrap">
                    <nue-div class="col-name__name" width="auto" gap=".5rem" align="center">
                        <span class="col-name__giveup-tag" v-if="todo.isGivenUp">已放弃</span>
                        <nue-text
                            :clamped="1"
                            color="var(--primary-text-color)"
                            size="var(--text-sm)"
                        >
                            {{ todo.name }}
                        </nue-text>
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
                    <nue-text :clamped="2" class="col-name__description" size="var(--text-xs)">
                        {{ todo.description }}
                    </nue-text>
                </nue-div>
            </nue-div>
            <nue-div v-if="columnOptions.createdAt" class="todo-table__main__col col-created-at">
                <nue-text :title="useRelativeDate(todo.createdAt)" size="var(--text-xs)">
                    {{ useRelativeDate(todo.createdAt) }}
                </nue-text>
            </nue-div>
            <nue-div v-if="columnOptions.updatedAt" class="todo-table__main__col col-updated-at">
                <nue-text :title="useRelativeDate(todo.updatedAt)" size="var(--text-xs)">
                    {{ useRelativeDate(todo.updatedAt) }}
                </nue-text>
            </nue-div>
            <nue-div
                v-if="columnOptions.endAt"
                :key="refreshKey"
                :data-expired="isTodoExpired(todo)"
                class="todo-table__main__col col-end-at"
            >
                <nue-text :title="useRelativeDate(todo.dueDate.endAt)" size="var(--text-xs)">
                    {{ useRelativeDate(todo.dueDate.endAt) }}
                </nue-text>
            </nue-div>
            <nue-div v-if="columnOptions.priority" class="todo-table__main__col col-priority">
                <todo-priority-info :key="todo.priority" :priority="todo.priority" use-clamped />
            </nue-div>
            <nue-div v-if="columnOptions.state" class="todo-table__main__col col-state">
                <todo-state-info :key="todo.state" :state="todo.state" use-clamped />
            </nue-div>
            <nue-div v-if="columnOptions.project" class="todo-table__main__col col-project">
                <nue-text :clamped="1" size="12px">
                    {{
                        todo.project?.title ||
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
