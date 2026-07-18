<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'
import TasksOperationsDropdown from '@/components/tasks/dropdowns/operations-dropdown.vue'
import { InnerDropdownOption, DropdownDivBlock } from '@nao-todo/components'
import ColumnDisplayOperator from '@/components/tasks/dropdowns/column-display-operator.vue'
import { BUILT_IN_PROJECT_VIEW_CONTEXT_KEY } from '../context'

const {
    subscriber,
    preference,
    switchViewTypeToTable,
    switchViewTypeToKanban,
    switchViewTypeToList,
    builtInProjectHandlers,
    isHideCompletedAlready,
    getColumnLabel
} = inject(BUILT_IN_PROJECT_VIEW_CONTEXT_KEY)!
// console.log(preference.value?.columns)

const dropdownRef = ref<InstanceType<typeof TasksOperationsDropdown>>()

const refreshHandler = () => subscriber.emit('RefreshData')
const switchCompletedTaskDisplay = () => builtInProjectHandlers.switchCompletedTaskDisplay()
const updatePreference = () => subscriber.emit('UpdatePreference')

// 注册 Dropdown 执行函数
onMounted(() => {
    if (!dropdownRef.value) return
    dropdownRef.value.register('switch-view-to-table', switchViewTypeToTable)
    dropdownRef.value.register('switch-view-to-kanban', switchViewTypeToKanban)
    dropdownRef.value.register('switch-view-to-list', switchViewTypeToList)
    dropdownRef.value.register('refresh-data', refreshHandler)
    dropdownRef.value.register('hide-completed', switchCompletedTaskDisplay)
    dropdownRef.value.register('save-preference', updatePreference)
})
</script>

<template>
    <tasks-operations-dropdown v-if="preference" ref="dropdownRef">
        <dropdown-div-block title="视图切换">
            <inner-dropdown-option
                icon="table"
                title="表格视图"
                execute-id="switch-view-to-table"
                :checked="preference.viewType === 'table'"
            />
            <inner-dropdown-option
                icon="kanban"
                title="看板视图"
                execute-id="switch-view-to-kanban"
                :checked="preference.viewType === 'kanban'"
            />
            <inner-dropdown-option
                icon="list"
                title="列表视图"
                execute-id="switch-view-to-list"
                :checked="preference.viewType === 'list'"
            />
        </dropdown-div-block>
        <nue-divider />
        <dropdown-div-block title="视图操作">
            <inner-dropdown-option icon="refresh" title="重新获取数据" execute-id="refresh-data" />
            <inner-dropdown-option
                :icon="isHideCompletedAlready ? 'eye' : 'eye-close'"
                :title="`${isHideCompletedAlready ? '显示' : '隐藏'}已完成任务`"
                execute-id="hide-completed"
            />
            <column-display-operator
                :columns="preference.columns"
                :label-getter="getColumnLabel"
                @update="(k, v) => builtInProjectHandlers.updateColumns(k, v)"
            />
            <inner-dropdown-option
                icon="picture"
                title="保存视图偏好"
                execute-id="save-preference"
            />
        </dropdown-div-block>
    </tasks-operations-dropdown>
</template>

