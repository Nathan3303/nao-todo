<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTasksViewStore, useTasksDataStore, useTasksDialogStore } from '@/stores/tasks'
import { TasksOperationsDropdown, TasksDropdownDivBlock } from '@/components/tasks/dropdowns'
import { getColumnText } from '@/components/tasks/table/utils'
// import { TagColorDot } from '@nao-todo/components'
import type { TodoColumnOptions } from '@nao-todo/types'
import {
    InnerDropdown,
    InnerDropdownOption,
    type InnerDropdownOptionVO
} from '@/components/ui/inner-dropdown'

defineOptions({ name: 'TasksMainTagOperationsDropdown' })

const tasksViewStore = useTasksViewStore()
const tasksDataStore = useTasksDataStore()
const tasksDialogStore = useTasksDialogStore()

const { viewProps } = storeToRefs(tasksViewStore)
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
    dropdownRef.value.register('switch-view-to-table', () => tasksViewStore.switchView('table'))
    dropdownRef.value.register('switch-view-to-kanban', () => tasksViewStore.switchView('kanban'))
    dropdownRef.value.register('switch-view-to-list', () => tasksViewStore.switchView('list'))
    dropdownRef.value.register('refresh-data', tasksViewStore.refreshData)
    dropdownRef.value.register('hide-completed', tasksViewStore.hideCompleted)
    dropdownRef.value.register('update-preference', tasksViewStore.updatePreference)
    dropdownRef.value.register('delete', () => tasksDataStore.deleteTag(viewProps.value!.id))
    dropdownRef.value.register('change-color', () => {
        tasksDialogStore.tagColorUpdater?.open(viewProps.value!.id)
    })
})
</script>

<template>
    <tasks-operations-dropdown v-if="viewProps" ref="dropdownRef">
        <tasks-dropdown-div-block title="视图切换">
            <nue-div gap="0.25rem" wrap="nowrap">
                <li data-executeid="switch-view-to-table">
                    <nue-icon v-if="viewProps.preference.viewType === 'table'" name="check" />表格
                </li>
                <li data-executeid="switch-view-to-kanban">
                    <nue-icon v-if="viewProps.preference.viewType === 'kanban'" name="check" />看板
                </li>
                <li data-executeid="switch-view-to-list">
                    <nue-icon v-if="viewProps.preference.viewType === 'list'" name="check" />列表
                </li>
            </nue-div>
        </tasks-dropdown-div-block>
        <nue-divider />
        <tasks-dropdown-div-block title="视图操作">
            <li data-executeid="refresh-data"><nue-icon name="refresh" />重新获取数据</li>
            <li data-executeid="hide-completed"><nue-icon name="eye-close" />隐藏已完成</li>
            <inner-dropdown
                @execute="tasksViewStore.updateColumns"
                title="显示与隐藏列"
                @click.stop
                :suffix="sortFieldDropdownOptions.count"
                group="tasks-view-operations"
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
            <li data-executeid="update-preference"><nue-icon name="picture" />保存视图偏好</li>
        </tasks-dropdown-div-block>
        <nue-divider />
        <tasks-dropdown-div-block title="标签操作">
            <li class="nue-dropdown-item" data-executeid="change-color">
                <nue-icon name="theme" />
                修改标签颜色
            </li>
            <li data-executeid="delete" style="color: red"><nue-icon name="delete" />删除标签</li>
        </tasks-dropdown-div-block>
    </tasks-operations-dropdown>
</template>
