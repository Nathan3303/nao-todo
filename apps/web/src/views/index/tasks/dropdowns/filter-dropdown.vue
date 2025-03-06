<template>
    <nue-dropdown placement="bottom-end" size="small" theme="menu">
        <template #default="{ clickTrigger }">
            <nue-badge
                theme="for-ico"
                dot
                :hidden="!(counter.priority + counter.state) && !isSorting"
            >
                <nue-button
                    icon="filter"
                    theme="icon-only"
                    @click.stop="clickTrigger"
                />
            </nue-badge>
        </template>
        <template #dropdown>
            <nue-div style="max-width: 10rem" gap="4px">
                <nue-div theme="block">
                    <nue-text theme="title">筛选</nue-text>
                    <inner-dropdown
                        @execute="handleStateDropdownExecute"
                        title="状态"
                        :suffix="counter.state"
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
        </template>
    </nue-dropdown>
</template>

<script setup lang="ts">
import { useTodoStore } from '@/stores'
import { InnerDropdown, InnerDropdownOption } from './inner-dropdown'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import {
    priorityOptions,
    stateOptions
} from '@nao-todo/components/todo/selector/constants'
import { computed } from 'vue'
import { columnOptionsInfoMap } from '@/views/index/tasks/constants'
import type { InnerDropdownOptionVO } from './inner-dropdown/types'

const route = useRoute()
const todoStore = useTodoStore()

const { getOptions, columnOptions } = storeToRefs(todoStore)

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
            label: columnOptionsInfoMap[
                key as keyof typeof columnOptionsInfoMap
            ],
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
    // todoStore.doGetTodos()
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
</script>

<style scoped>
.nue-badge--for-ico:deep(.nue-badge__content) {
    width: 12px;
    left: calc(100% - 12px);
    bottom: calc(100% - 12px);
}
</style>
