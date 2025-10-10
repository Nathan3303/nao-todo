<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useTasksViewStore } from '@/stores/tasks'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { InnerDropdown, InnerDropdownOption } from '@/components/ui/inner-dropdown'
import { getColumnText } from '@/components/tasks/table'
import { priorityOptions, stateOptions } from '@nao-todo/components/todo/selector/constants'
import type { InnerDropdownOptionVO } from '@/components/ui/inner-dropdown/types'
import type { Todo } from '@nao-todo/types'

const route = useRoute()
const tasksViewStore = useTasksViewStore()

const { viewProps } = storeToRefs(tasksViewStore)
const searchText = ref('')

const isSorting = computed(() => !!viewProps.value?.preference.getTodosOptions.sort?.field)

const counter = computed(() => {
    if (!viewProps.value) return { priority: 0, state: 0 }
    const _getOptions = viewProps.value.preference.getTodosOptions
    const priority = _getOptions.priority?.split(',').filter((item) => item).length || 0
    const state = _getOptions.state?.split(',').filter((item) => item).length || 0
    return { priority, state }
})

const priorityDropdownOptions = computed<InnerDropdownOptionVO[]>(() => {
    if (!viewProps.value) return []
    const _getOptions = viewProps.value.preference.getTodosOptions
    return priorityOptions.map((option) => ({
        ...option,
        checked: _getOptions.priority?.includes(option.value) || false
    }))
})

const stateDropdownOptions = computed<InnerDropdownOptionVO[]>(() => {
    if (!viewProps.value) return []
    const _getOptions = viewProps.value.preference.getTodosOptions
    return stateOptions.map((option) => ({
        ...option,
        checked: _getOptions.state?.includes(option.value) || false
    }))
})

const sortFieldDropdownOptions = computed<InnerDropdownOptionVO[]>(() => {
    if (!viewProps.value) return []
    const _columnOptions = viewProps.value.preference.columns
    const _getOptions = viewProps.value.preference.getTodosOptions
    const _fields: InnerDropdownOptionVO[] = []
    Object.keys(_columnOptions).forEach((key) => {
        _fields.push({
            icon: 'plus-circle',
            label: getColumnText(key),
            value: key,
            checked: _getOptions.sort?.field === key || false
        })
    })
    return _fields
})

const sortOrderDropdownOptions = computed<InnerDropdownOptionVO[]>(() => {
    if (!viewProps.value) return []
    const _getOptions = viewProps.value.preference.getTodosOptions
    const isAsc = _getOptions.sort?.order === 'asc'
    return [
        { icon: 'arrow-up', label: '升序', value: 'asc', checked: isAsc },
        { icon: 'arrow-down', label: '降序', value: 'desc', checked: !isAsc }
    ]
})

const handlePriorityOrState = (isPriority: boolean, field: string) => {
    if (!viewProps.value) return
    const _getOptions = viewProps.value.preference.getTodosOptions
    const opKey = isPriority ? 'priority' : 'state'
    let target = _getOptions[opKey] ?? ''
    const splitRes = target.split(',').filter((item) => item)
    const idx = splitRes.indexOf(field)
    if (idx !== -1) {
        splitRes.splice(idx, 1)
    } else {
        splitRes.push(field)
    }
    _getOptions[opKey] = splitRes.join(',')
    counter.value[opKey] = splitRes.length
    const viewType = route.meta.viewType as string
    if (!isPriority && ['kanban'].includes(viewType)) return
}

const handlePriorityDropdownExecute = (field: string) => {
    handlePriorityOrState(true, field)
}

const handleStateDropdownExecute = (field: string) => {
    handlePriorityOrState(false, field)
}

const handleSortFieldDropdownExecute = (field: string) => {
    if (!viewProps.value) return
    const _getOptions = viewProps.value.preference.getTodosOptions
    if (field === _getOptions.sort?.field) {
        _getOptions.sort = { field: 'createdAt', order: 'desc' }
    } else {
        _getOptions.sort = { field: field as keyof Todo, order: _getOptions.sort?.order || 'asc' }
    }
}

const handleSortOrderDropdownExecute = (order: string) => {
    if (!viewProps.value) return
    const _getOptions = viewProps.value.preference.getTodosOptions
    _getOptions.sort = {
        field: _getOptions.sort?.field || 'createdAt',
        order: order === 'desc' ? 'desc' : 'asc'
    }
}

watch(
    () => searchText.value,
    (newValue) => {
        if (!viewProps.value) return
        const _getOptions = viewProps.value.preference.getTodosOptions
        _getOptions.name = newValue || ''
    }
)
</script>

<template>
    <nue-dropdown placement="bottom-end" size="small" theme="menu" group="tasks-view-filters">
        <template #trigger="{ trigger }">
            <nue-badge
                theme="for-ico-btn"
                dot
                :hidden="!(counter.priority + counter.state) && !searchText && !isSorting"
            >
                <nue-button icon="filter" theme="icon,ghost" @click.stop="trigger" />
            </nue-badge>
        </template>
        <nue-div gap="4px" style="width: 12rem">
            <nue-div theme="block">
                <nue-text theme="title">筛选</nue-text>
                <nue-input
                    theme="noshape,small"
                    placeholder="根据名称筛选"
                    v-model="searchText"
                    clearable
                    icon="search"
                    :debounce-time="360"
                    style="width: 100%"
                />
                <inner-dropdown
                    @execute="handleStateDropdownExecute"
                    title="状态"
                    :suffix="counter.state"
                    group="tasks-view-filters"
                >
                    <nue-text
                        v-if="viewProps?.id === 'overdue'"
                        size="var(--nue-text-xs)"
                        color="var(--nue-primary-color-600)"
                        style="padding: 0.5rem"
                    >
                        当前分类不允许操作
                    </nue-text>
                    <inner-dropdown-option
                        v-else
                        v-for="option in stateDropdownOptions"
                        :key="option.label"
                        :icon="option.icon"
                        :title="option.label"
                        :execute-id="option.value"
                        :checked="option.checked"
                    />
                </inner-dropdown>
                <inner-dropdown
                    @execute="handlePriorityDropdownExecute"
                    title="优先级"
                    :suffix="counter.priority"
                    group="tasks-view-filters"
                >
                    <inner-dropdown-option
                        v-for="option in priorityDropdownOptions"
                        :key="option.label"
                        :icon="option.icon"
                        :title="option.label"
                        :execute-id="option.value"
                        :checked="option.checked"
                    />
                </inner-dropdown>
            </nue-div>
            <nue-divider />
            <nue-div theme="block">
                <nue-text theme="title">排序</nue-text>
                <inner-dropdown
                    title="字段"
                    icon="select"
                    :suffix="isSorting"
                    @execute="handleSortFieldDropdownExecute"
                    group="tasks-view-filters"
                >
                    <inner-dropdown-option
                        v-for="option in sortFieldDropdownOptions"
                        :key="option.label"
                        :icon="option.icon"
                        :title="option.label"
                        :execute-id="option.value"
                        :checked="option.checked"
                    />
                </inner-dropdown>
                <inner-dropdown
                    title="顺序"
                    icon="select"
                    :disabled="!isSorting"
                    :suffix="isSorting"
                    @execute="handleSortOrderDropdownExecute"
                    group="tasks-view-filters"
                >
                    <inner-dropdown-option
                        v-for="option in sortOrderDropdownOptions"
                        :key="option.label"
                        :icon="option.icon"
                        :title="option.label"
                        :execute-id="option.value"
                        :checked="option.checked"
                    />
                </inner-dropdown>
            </nue-div>
        </nue-div>
    </nue-dropdown>
</template>

<style scoped>
.nue-input {
    border: none;
    border-radius: 0;
    --nue-icon-size: var(--nue-text-sm);
    font-size: var(--nue-text-sm);
    padding: 0 8px;
    gap: 8px;
}
</style>
