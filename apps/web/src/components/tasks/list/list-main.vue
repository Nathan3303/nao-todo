<script setup lang="ts">
import { inject } from 'vue'
import { TODO_LIST_CONTEXT_KEY } from './constants'
import {
    TodoStateInfo,
    TodoPriorityInfo,
    TodoDateInfo,
    TodoBasicInfo,
    TodoTagBar
} from '@nao-todo/components'
import type { TodoListContext } from './types'
import type { NueDiv } from 'nue-ui'

defineOptions({ name: 'TodoListMain' })

const {
    todos,
    tags,
    columns,
    refreshKey,
    selectRange,
    tagBarClamped,
    getProjectName,
    showTodoDetailsPanel,
    showMultiSelectPanel,
    deleteButtonClickHandler
} = inject<TodoListContext>(TODO_LIST_CONTEXT_KEY)!
</script>

<template>
    <nue-div theme="todo-list-main">
        <nue-div
            v-for="(todo, idx) in todos"
            theme="todo-list-main__row"
            :key="todo.id + refreshKey"
            :data-done="todo.state === 'done'"
            :data-selected="idx >= selectRange.start && idx <= selectRange.end"
            :data-deleted="todo.isDeleted"
            @click.stop.exact="showTodoDetailsPanel(todo.id, idx)"
            @click.stop.shift.exact="showMultiSelectPanel(idx)"
        >
            <nue-div theme="todo-list-main__row__first">
                <nue-div theme="todo-list__main__row__first__name-wrapper">
                    <nue-text :clamped="1" :title="todo.name">{{ todo.name }}</nue-text>
                    <nue-icon v-if="columns.isFavorited" name="heart-fill" color="pink" />
                    <todo-tag-bar
                        v-if="columns.tags && todo.tags.length"
                        :clamped="tagBarClamped"
                        :tags="tags"
                        :todoTags="todo.tags"
                        readonly
                        small
                    />
                    <nue-divider vertical />
                    <nue-div theme="todo-list-main__row__actions">
                        <slot :todo="todo" name="row-actions">
                            <nue-button
                                :icon="(todo.isDeleted ? 'restore' : 'delete') as never"
                                theme="icon,ghost,pure"
                                @click.stop="deleteButtonClickHandler(todo.id, todo.isDeleted)"
                            />
                        </slot>
                    </nue-div>
                </nue-div>
                <nue-text
                    v-if="columns.description && todo.description"
                    :clamped="2"
                    :title="todo.description"
                    theme="description"
                >
                    {{ todo.description }}
                </nue-text>
            </nue-div>
            <nue-div theme="todo-list-main__row__attrs">
                <todo-state-info v-if="columns?.state" :state="todo.state" />
                <todo-priority-info v-if="columns?.priority" :priority="todo.priority" />
                <todo-date-info
                    v-if="columns.createdAt"
                    :date="todo.createdAt"
                    :formatter="(date) => `创建时间： ${date}`"
                />
                <todo-date-info
                    v-if="columns?.updatedAt"
                    :date="todo.updatedAt"
                    :formatter="(date) => `更新时间： ${date}`"
                />
                <todo-date-info
                    v-if="columns?.endAt"
                    :date="todo.endAt!"
                    :formatter="(date) => `结束时间： ${date}`"
                />
                <todo-basic-info
                    v-if="columns?.project"
                    icon="inbox-fill"
                    :text="'清单：' + getProjectName(todo.projectId) || '收集箱'"
                />
            </nue-div>
        </nue-div>
    </nue-div>
</template>
