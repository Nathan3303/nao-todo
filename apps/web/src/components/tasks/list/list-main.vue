<script setup lang="ts">
import { inject } from 'vue'
import {
    TodoStateInfo,
    TodoPriorityInfo,
    TodoDateInfo,
    TodoBasicInfo,
    TodoTagBar
} from '@nao-todo/components'
import { TASK_LIST_CONTEXT_KEY } from './use-list'
import type { TaskListContext } from './types'

defineOptions({ name: 'TaskListMain' })

const {
    tasks,
    tags,
    columns,
    tagBarClamped,
    isInMultiSelectRange,
    getProjectName,
    showTaskDetails,
    showMultiSelectPanel,
    deleteOrRestore
} = inject<TaskListContext>(TASK_LIST_CONTEXT_KEY)!
</script>

<template>
    <nue-div theme="todo-list-main">
        <nue-div
            v-for="(task, idx) in tasks"
            theme="todo-list-main__row"
            :key="task.id"
            :data-done="task.state === 'done'"
            :data-selected="isInMultiSelectRange(idx)"
            :data-deleted="task.isDeleted"
            @click.stop.exact="showTaskDetails(task.id, idx)"
            @click.stop.shift.exact="showMultiSelectPanel(idx)"
        >
            <nue-div theme="todo-list-main__row__first">
                <nue-div theme="todo-list__main__row__first__name-wrapper">
                    <nue-text :clamped="1" :title="task.name">{{ task.name }}</nue-text>
                    <nue-icon v-if="columns.isFavorited" name="heart-fill" color="pink" />
                    <todo-tag-bar
                        v-if="columns.tags && task.tags.length"
                        :clamped="tagBarClamped"
                        :tags="tags"
                        :todoTags="task.tags"
                        readonly
                        small
                    />
                    <nue-divider vertical />
                    <nue-div theme="todo-list-main__row__actions">
                        <slot :todo="task" name="row-actions">
                            <nue-button
                                :icon="(task.isDeleted ? 'restore' : 'delete') as never"
                                theme="icon,ghost,pure"
                                @click.stop="deleteOrRestore(task.id, task.isDeleted)"
                            />
                        </slot>
                    </nue-div>
                </nue-div>
                <nue-text
                    v-if="columns.description && task.description"
                    :clamped="2"
                    :title="task.description"
                    theme="description"
                >
                    {{ task.description }}
                </nue-text>
            </nue-div>
            <nue-div theme="todo-list-main__row__attrs">
                <todo-state-info v-if="columns?.state" :state="task.state" />
                <todo-priority-info v-if="columns?.priority" :priority="task.priority" />
                <todo-date-info
                    v-if="columns.createdAt"
                    :date="task.createdAt"
                    :formatter="(date) => `创建时间： ${date}`"
                />
                <todo-date-info
                    v-if="columns?.updatedAt"
                    :date="task.updatedAt"
                    :formatter="(date) => `更新时间： ${date}`"
                />
                <todo-date-info
                    v-if="columns?.endAt"
                    :date="task.endAt!"
                    :formatter="(date) => `结束时间： ${date}`"
                    :colored="!(task.state === 'done')"
                />
                <todo-basic-info
                    v-if="columns?.project"
                    icon="inbox-fill"
                    :text="'清单：' + getProjectName(task.projectId) || '收集箱'"
                />
            </nue-div>
        </nue-div>
    </nue-div>
</template>
