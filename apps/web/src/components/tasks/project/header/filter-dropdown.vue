<script setup lang="ts">
import {
    TaskNameFilter,
    TaskStateFilter,
    TaskPriorityFilter,
    TaskSortOperator
} from '@nao-todo/presentation/task'
import { DropdownDivBlock } from '@nao-todo/shared'
import { computed, inject, watch } from 'vue'
import { PROJECT_VIEW_CONTEXT_KEY } from '../context'

defineOptions({ name: 'TasksTodoFilterDropdown' })
defineEmits<{ (e: 'getTodos'): void }>()

const { preference, subscriber, projectHandler } = inject(PROJECT_VIEW_CONTEXT_KEY)!

// @proxy 清单偏好上下文 名称 属性代理
const getTasksOptionsName = computed({
    get: () => preference.value?.getTasksOptions?.name || '',
    set: (name) => projectHandler.updateGetTasksOptions('name', name)
})

// @proxy 清单偏好上下文 状态 属性代理
const getTasksOptionsState = computed({
    get: () => preference.value?.getTasksOptions?.state || '',
    set: (state) => projectHandler.updateGetTasksOptions('state', state)
})

// @proxy 清单偏好上下文 优先级 属性代理
const getTasksOptionsPriority = computed({
    get: () => preference.value?.getTasksOptions?.priority || '',
    set: (priority) => projectHandler.updateGetTasksOptions('priority', priority)
})

// @proxy 清单偏好上下文 排序 属性代理
const getTasksOptionsSort = computed({
    get: () =>
        preference.value?.getTasksOptions?.sort || {
            field: 'createdAt',
            order: 'asc'
        },
    set: (sort) => projectHandler.updateGetTasksOptions('sort', sort)
})

// @watch 清单偏好上下文 状态 属性代理
watch(
    () => [
        getTasksOptionsName.value,
        getTasksOptionsState.value,
        getTasksOptionsPriority.value,
        getTasksOptionsSort.value
    ],
    () => subscriber.emit('RefreshData')
)
</script>

<template>
    <nue-dropdown
        v-if="preference"
        placement="bottom-end"
        size="small"
        theme="menu"
        group="tasks-todo-filter"
    >
        <template #trigger="{ trigger }">
            <nue-badge theme="for-ico-btn" dot>
                <nue-button icon="filter" theme="icon,ghost" @click.stop="trigger" />
            </nue-badge>
        </template>
        <dropdown-div-block title="筛选">
            <task-name-filter placeholder="筛选任务" v-model="getTasksOptionsName" />
            <task-state-filter v-model="getTasksOptionsState" />
            <task-priority-filter v-model="getTasksOptionsPriority" />
        </dropdown-div-block>
        <nue-divider />
        <dropdown-div-block title="排序">
            <task-sort-operator
                v-model="getTasksOptionsSort"
                :get-tasks-options="preference.getTasksOptions"
                :columns="preference.columns"
            />
        </dropdown-div-block>
    </nue-dropdown>
</template>

<style scoped></style>