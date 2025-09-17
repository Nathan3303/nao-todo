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
                />
                <inner-dropdown
                    @execute="handleStateDropdownExecute"
                    title="状态"
                    :suffix="counter.state"
                    group="tasks-view-filters"
                >
                    <inner-dropdown-option
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

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useTodoStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { InnerDropdown, InnerDropdownOption } from '@/components/ui/inner-dropdown'
import { priorityOptions, stateOptions } from '@nao-todo/components/todo/selector/constants'
import { columnOptionsInfoMap } from '@/views/tasks/constants'
import type { InnerDropdownOptionVO } from '@/components/ui/inner-dropdown/types'

const route = useRoute()
const todoStore = useTodoStore()

const { getOptions, columnOptions } = storeToRefs(todoStore)
const searchText = ref('')

const isSorting = computed(() => !!getOptions.value.sort?.field)

const counter = computed(() => {
    const _go = getOptions.value
    const priority = _go.priority?.split(',').filter((item) => item).length || 0
    const state = _go.state?.split(',').filter((item) => item).length || 0
    return { priority, state }
})

const priorityDropdownOptions = computed<InnerDropdownOptionVO[]>(() => {
    return priorityOptions.map((option) => ({
        ...option,
        checked: getOptions.value.priority?.includes(option.value) || false
    }))
})

const stateDropdownOptions = computed<InnerDropdownOptionVO[]>(() => {
    return stateOptions.map((option) => ({
        ...option,
        checked: getOptions.value.state?.includes(option.value) || false
    }))
})

const sortFieldDropdownOptions = computed<InnerDropdownOptionVO[]>(() => {
    const _fields: InnerDropdownOptionVO[] = []
    Object.keys(columnOptions.value).forEach((key) => {
        _fields.push({
            icon: 'plus-circle',
            label: columnOptionsInfoMap[key as keyof typeof columnOptionsInfoMap],
            value: key,
            checked: getOptions.value.sort?.field === key || false
        })
    })
    return _fields
})

const sortOrderDropdownOptions = computed<InnerDropdownOptionVO[]>(() => {
    const isAsc = getOptions.value.sort?.order === 'asc'
    return [
        { icon: 'arrow-up', label: '升序', value: 'asc', checked: isAsc },
        { icon: 'arrow-down', label: '降序', value: 'desc', checked: !isAsc }
    ]
})

const handlePriorityOrState = (isPriority: boolean, field: string) => {
    const opKey = isPriority ? 'priority' : 'state'
    let target = getOptions.value[opKey] ?? ''
    const splitRes = target.split(',').filter((item) => item)
    const idx = splitRes.indexOf(field)
    if (idx !== -1) {
        splitRes.splice(idx, 1)
    } else {
        splitRes.push(field)
    }
    todoStore.mergeGetOptions({ [opKey]: splitRes.join(',') })
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
    if (field === getOptions.value.sort?.field) {
        todoStore.mergeGetOptions({
            sort: { field: '', order: 'asc' }
        })
    } else {
        todoStore.mergeGetOptions({
            sort: { field, order: getOptions.value.sort?.order || 'asc' }
        })
    }
    // todoStore.doGetTodos()
}

const handleSortOrderDropdownExecute = (order: string) => {
    todoStore.mergeGetOptions({
        sort: {
            field: getOptions.value.sort?.field || 'createdAt',
            order: order === 'desc' ? 'desc' : 'asc'
        }
    })
    // todoStore.doGetTodos()
}

watch(
    () => searchText.value,
    (newValue) => {
        todoStore.mergeGetOptions({ name: newValue || null })
    }
)
</script>

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
