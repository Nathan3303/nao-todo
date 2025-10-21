<script setup lang="ts">
import { inject } from 'vue'
import { TodoPriorityInfo, TodoStateInfo, TodoTagBar } from '@nao-todo/components'
import { useRelativeDate } from '@nao-todo/hooks'
import { TODO_TABLE_CONTEXT_KEY } from './constants'
import type { TodoTableContext } from './types'
import type { NueDiv } from 'nue-ui'

defineOptions({ name: 'TodoTableMain' })

const {
    todos,
    tags,
    refreshKey,
    selectRange,
    columnOptions,
    tagBarClamped,
    isTodoExpired,
    getProjectName,
    showTodoDetailsPanel,
    showMultiSelectPanel,
    deleteButtonClickHandler
} = inject<TodoTableContext>(TODO_TABLE_CONTEXT_KEY)!
</script>

<template>
    <nue-div class="todo-table__main">
        <nue-div
            v-for="(todo, idx) in todos"
            :key="todo.id + refreshKey"
            :data-done="todo.state === 'done'"
            :data-selected="idx >= selectRange.start && idx <= selectRange.end"
            :data-deleted="todo.isDeleted"
            :data-giveup="todo.isGivenUp"
            class="todo-table__main__row"
            @click.stop.exact="showTodoDetailsPanel(todo.id, idx)"
            @click.stop.shift.exact="showMultiSelectPanel(idx)"
        >
            <nue-div class="todo-table__main__col col-first" vertical>
                <nue-div class="col-first__name-wrapper">
                    <nue-text theme="todo-name" :clamped="1" :title="todo.name">
                        {{ todo.name }}
                    </nue-text>
                    <todo-tag-bar
                        v-if="columnOptions.tags && todo.tags.length"
                        :clamped="tagBarClamped"
                        :tags="tags"
                        :todoTags="todo.tags"
                        readonly
                        small
                    />
                </nue-div>
                <nue-div v-if="columnOptions.description && todo.description" vertical>
                    <nue-text :clamped="2" class="col-first__description" :title="todo.description">
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
                <todo-priority-info :key="todo.priority" :priority="todo.priority" use-clamped />
            </nue-div>
            <nue-div v-if="columnOptions.state" class="todo-table__main__col col-attr">
                <todo-state-info :key="todo.state" :state="todo.state" use-clamped />
            </nue-div>
            <nue-div v-if="columnOptions.project" class="todo-table__main__col col-attr">
                <nue-text :clamped="1" :title="getProjectName(todo.projectId)">
                    {{ getProjectName(todo.projectId) || '收集箱' }}
                </nue-text>
            </nue-div>
            <nue-div class="todo-table__main__col col-actions">
                <slot :todo="todo" name="row-actions">
                    <nue-icon
                        :name="todo.isDeleted ? 'restore' : 'delete'"
                        @click.stop="deleteButtonClickHandler(todo.id, todo.isDeleted)"
                    />
                </slot>
            </nue-div>
        </nue-div>
    </nue-div>
</template>
