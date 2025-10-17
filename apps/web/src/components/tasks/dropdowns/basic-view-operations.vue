<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTasksViewStore } from '@/stores/tasks'
import TasksOperationsDropdown from './operations-dropdown.vue'
import TasksDropdownDivBlock from '@/components/ui/div-block.vue'
import { getColumnText } from '@/components/tasks/table/utils'
import { useTasksBasicViewStore } from '@/stores/tasks'
import {
    InnerDropdown,
    InnerDropdownOption,
    type InnerDropdownOptionVO
} from '@/components/ui/inner-dropdown'
import type { TodoColumnOptions } from '@nao-todo/types'

defineOptions({ name: 'TasksBasicViewOperationsDropdown' })

const tasksViewStore = useTasksViewStore()
const tasksBasicViewStore = useTasksBasicViewStore()

const { viewProps } = storeToRefs(tasksViewStore)
const { allowReload, isHideCompletedAlready } = storeToRefs(tasksBasicViewStore)
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
    dropdownRef.value.register('switch-view-to-table', tasksBasicViewStore.handleSwitchToTable)
    dropdownRef.value.register('switch-view-to-kanban', tasksBasicViewStore.handleSwitchToKanban)
    dropdownRef.value.register('switch-view-to-list', tasksBasicViewStore.handleSwitchToList)
    dropdownRef.value.register('refresh-data', tasksBasicViewStore.handleRefreshData)
    dropdownRef.value.register('hide-completed', tasksBasicViewStore.handleHideCompleted)
    dropdownRef.value.register('update-preference', tasksBasicViewStore.handleUpdatePreference)
})
</script>

<template>
    <tasks-operations-dropdown v-if="viewProps" ref="dropdownRef">
        <tasks-dropdown-div-block title="视图切换">
            <inner-dropdown-option
                icon="table"
                title="表格视图"
                execute-id="switch-view-to-table"
                :checked="viewProps.preference.viewType === 'table'"
            />
            <inner-dropdown-option
                icon="kanban"
                title="看板视图"
                execute-id="switch-view-to-kanban"
                :checked="viewProps.preference.viewType === 'kanban'"
            />
            <inner-dropdown-option
                icon="list"
                title="列表视图"
                execute-id="switch-view-to-list"
                :checked="viewProps.preference.viewType === 'list'"
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
                :icon="isHideCompletedAlready ? 'eye' : 'eye-close'"
                :title="isHideCompletedAlready ? '显示已完成' : '隐藏已完成'"
                execute-id="hide-completed"
            />
            <inner-dropdown
                @execute="tasksViewStore.updateColumns"
                title="显示与隐藏列"
                @click.stop
                :suffix="sortFieldDropdownOptions.count"
                :close-when-executed="false"
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
            <inner-dropdown-option
                icon="picture"
                title="保存视图偏好"
                execute-id="update-preference"
            />
        </tasks-dropdown-div-block>
    </tasks-operations-dropdown>
</template>
