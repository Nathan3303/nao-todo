<script setup lang="ts">
import TextFilter from '@/components/tasks/dropdowns/input-filter.vue'
import StateFilter from '@/components/tasks/dropdowns/state-filter.vue'
import PriorityFilter from '@/components/tasks/dropdowns/priority-filter.vue'
import { DivBlock } from '@/components/ui'
import { PROJECT_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { ProjectViewContext } from '../types'
import { computed, inject } from 'vue'
import SortOperator from '@/components/tasks/dropdowns/sort-operator.vue'

defineOptions({ name: 'TasksTodoFilterDropdown' })
defineEmits<{ (e: 'getTodos'): void }>()

const viewContext = inject<ProjectViewContext>(PROJECT_VIEW_CONTEXT_KEY)

// @proxy 清单偏好上下文 名称 属性代理
const getTasksOptionsName = computed({
    get: () => viewContext?.preference.value?.getTasksOptions?.name || '',
    set: (name) => {
        if (!viewContext || !viewContext.preference.value) return
        viewContext.preference.value.getTasksOptions.name = name
    }
})

// @proxy 清单偏好上下文 状态 属性代理
const getTasksOptionsState = computed({
    get: () => viewContext?.preference.value?.getTasksOptions?.state || '',
    set: (state) => {
        if (!viewContext?.preference.value?.getTasksOptions) return
        viewContext.preference.value.getTasksOptions.state = state
    }
})

// @proxy 清单偏好上下文 优先级 属性代理
const getTasksOptionsPriority = computed({
    get: () => viewContext?.preference.value?.getTasksOptions?.priority || '',
    set: (priority) => {
        if (!viewContext?.preference.value?.getTasksOptions) return
        viewContext.preference.value.getTasksOptions.priority = priority
    }
})

// @proxy 清单偏好上下文 排序 属性代理
const getTasksOptionsSort = computed({
    get: () =>
        viewContext?.preference.value?.getTasksOptions?.sort || {
            field: 'createdAt',
            order: 'asc'
        },
    set: (sort) => {
        if (!viewContext?.preference.value?.getTasksOptions) return
        viewContext.preference.value.getTasksOptions.sort = sort
    }
})
</script>

<template>
    <nue-dropdown
        v-if="viewContext && viewContext.preference.value"
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
        <div-block title="筛选">
            <text-filter placeholder="筛选任务" v-model="getTasksOptionsName" />
            <state-filter
                v-if="viewContext.preference.value.projectId !== 'overdue'"
                v-model="getTasksOptionsState"
            />
            <priority-filter v-model="getTasksOptionsPriority" />
        </div-block>
        <nue-divider />
        <div-block title="排序">
            <sort-operator
                v-model="getTasksOptionsSort"
                :get-tasks-options="viewContext.preference.value.getTasksOptions"
                :columns="viewContext.preference.value.columns"
            />
        </div-block>
    </nue-dropdown>
</template>

<style scoped></style>

