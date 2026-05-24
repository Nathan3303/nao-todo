<script setup lang="ts">
import TextFilter from '@/components/tasks/dropdowns/input-filter.vue'
import StateFilter from '@/components/tasks/dropdowns/state-filter.vue'
import PriorityFilter from '@/components/tasks/dropdowns/priority-filter.vue'
import { DropdownDivBlock } from '@nao-todo/components'
import { BUILT_IN_PROJECT_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { BuiltInProjectViewContext } from '../types'
import { computed, inject, watch } from 'vue'
import SortOperator from '@/components/tasks/dropdowns/sort-operator.vue'

defineOptions({ name: 'TasksTodoFilterDropdown' })
defineEmits<{ (e: 'getTodos'): void }>()

const { preference, subscriber } = inject<BuiltInProjectViewContext>(
    BUILT_IN_PROJECT_VIEW_CONTEXT_KEY
)!

// @proxy 清单偏好上下文 名称 属性代理
const getTasksOptionsName = computed({
    get: () => preference.value?.getTasksOptions?.name || '',
    set: (name) => {
        if (!preference.value) return
        preference.value.getTasksOptions.name = name
    }
})

// @proxy 清单偏好上下文 状态 属性代理
const getTasksOptionsState = computed({
    get: () => preference.value?.getTasksOptions?.state || '',
    set: (state) => {
        if (!preference.value) return
        preference.value.getTasksOptions.state = state
    }
})

// @proxy 清单偏好上下文 优先级 属性代理
const getTasksOptionsPriority = computed({
    get: () => preference.value?.getTasksOptions?.priority || '',
    set: (priority) => {
        if (!preference.value) return
        preference.value.getTasksOptions.priority = priority
    }
})

// @proxy 清单偏好上下文 排序 属性代理
const getTasksOptionsSort = computed({
    get: () => preference.value?.getTasksOptions?.sort || { field: 'createdAt', order: 'asc' },
    set: (sort) => {
        if (!preference.value) return
        preference.value.getTasksOptions.sort = sort
    }
})

// @computed 根据清单偏好计算当前的筛选条件数量
const filterCount = computed(() => {
    let count = 0
    if (getTasksOptionsName.value) count += 1
    if (getTasksOptionsState.value) count += 1
    if (getTasksOptionsPriority.value) count += 1
    return !!count
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
            <nue-badge theme="for-ico-btn" :dot="filterCount">
                <nue-button icon="filter" theme="icon,ghost" @click.stop="trigger" />
            </nue-badge>
        </template>
        <dropdown-div-block title="筛选">
            <text-filter placeholder="筛选任务" v-model="getTasksOptionsName" />
            <state-filter
                v-if="preference.projectId !== 'overdue'"
                v-model="getTasksOptionsState"
            />
            <priority-filter v-model="getTasksOptionsPriority" />
        </dropdown-div-block>
        <nue-divider />
        <dropdown-div-block title="排序">
            <sort-operator
                v-model="getTasksOptionsSort"
                :get-tasks-options="preference.getTasksOptions"
                :columns="preference.columns"
            />
        </dropdown-div-block>
    </nue-dropdown>
</template>

<style scoped></style>

