<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTasksViewStore } from '@/stores/tasks'
import { TasksOperationsDropdown, TasksDropdownDivBlock } from '@/components/tasks/dropdowns'
import {
    InnerDropdown,
    InnerDropdownOption,
    type InnerDropdownOptionVO
} from '@/components/ui/inner-dropdown'
import { getColumnText } from '@/components/tasks/table/utils'
import useTasksMainBasicStore from '../use-tasks-main-basic-store'
import type { TodoColumnOptions } from '@nao-todo/types'

defineOptions({ name: 'TasksMainBasicOperationsDropdown' })

const tasksMainBasicStore = useTasksMainBasicStore()
const tasksViewStore = useTasksViewStore()

const { viewProps } = storeToRefs(tasksViewStore)
const { allowReload, loading, isHideCompletedAlready } = storeToRefs(tasksMainBasicStore)
const dropdownRef = ref<InstanceType<typeof TasksOperationsDropdown>>()

// @computed 列选项转下拉列表项
const sortFieldDropdownOptions = computed<{
    options: InnerDropdownOptionVO[]
    count: number
}>(() => {
    const _fields: InnerDropdownOptionVO[] = []
    let count = 0
    if (viewProps.value) {
        const columnOptions = viewProps.value.preference.columns
        Object.keys(columnOptions).forEach((key) => {
            const isChecked = columnOptions[key as keyof TodoColumnOptions]
            if (isChecked) count++
            _fields.push({
                icon: 'plus-circle',
                label: getColumnText(key),
                value: key,
                checked: isChecked
            })
        })
    }
    return { options: _fields, count }
})

// 注册 Dropdown 执行函数
onMounted(() => {
    if (!dropdownRef.value) return
    dropdownRef.value.register('switch-view-to-table', tasksMainBasicStore.handleSwitchToTable)
    dropdownRef.value.register('switch-view-to-kanban', tasksMainBasicStore.handleSwitchToKanban)
    dropdownRef.value.register('switch-view-to-list', tasksMainBasicStore.handleSwitchToList)
    dropdownRef.value.register('refresh-data', tasksMainBasicStore.handleRefreshData)
    dropdownRef.value.register('hide-completed', tasksMainBasicStore.handleHideCompleted)
})
</script>

<template>
    <tasks-operations-dropdown v-if="viewProps" ref="dropdownRef">
        <tasks-dropdown-div-block title="视图切换">
            <inner-dropdown-option
                icon="theme"
                title="表格视图"
                execute-id="switch-view-to-table"
                :checked="viewProps.preference.viewType === 'table'"
                :disabled="loading"
            />
            <inner-dropdown-option
                icon="theme"
                title="看板视图"
                execute-id="switch-view-to-kanban"
                :checked="viewProps.preference.viewType === 'kanban'"
                :disabled="loading"
            />
            <inner-dropdown-option
                icon="theme"
                title="列表视图"
                execute-id="switch-view-to-list"
                :checked="viewProps.preference.viewType === 'list'"
                :disabled="loading"
            />
        </tasks-dropdown-div-block>
        <nue-divider />
        <tasks-dropdown-div-block title="视图操作">
            <inner-dropdown-option
                icon="refresh"
                title="重新获取数据"
                execute-id="refresh-data"
                :disabled="!allowReload"
            />
            <inner-dropdown-option
                icon="eye-close"
                title="隐藏已完成"
                execute-id="hide-completed"
                :checked="isHideCompletedAlready"
            />
            <inner-dropdown
                @execute="tasksViewStore.updateColumns"
                title="显示与隐藏列"
                @click.stop
                :suffix="sortFieldDropdownOptions.count"
            >
                <inner-dropdown-option
                    v-for="option in sortFieldDropdownOptions.options"
                    :key="option.label"
                    :icon="option.icon"
                    :title="option.label"
                    :execute-id="option.value"
                    :checked="option.checked"
                />
            </inner-dropdown>
            <!-- <li data-executeid="update-preference"><nue-icon name="picture" />保存视图偏好</li> -->
        </tasks-dropdown-div-block>
    </tasks-operations-dropdown>
</template>
