<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'
import TasksOperationsDropdown from '@/components/tasks/dropdowns/operations-dropdown.vue'
import { InnerDropdownOption, DivBlock } from '@/components/ui'
import ColumnDisplayOperator from '@/components/tasks/dropdowns/column-display-operator.vue'
import { BUILT_IN_PROJECT_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { BuiltInProjectViewContext } from '../types'

defineOptions({ name: 'TasksProjectOperationsDropdown' })

const {
    subscriber,
    preference,
    switchViewTypeToTable,
    switchViewTypeToKanban,
    switchViewTypeToList,
    builtInProjectHandlers,
    isHideCompletedAlready,
    getColumnLabel
} = inject<BuiltInProjectViewContext>(BUILT_IN_PROJECT_VIEW_CONTEXT_KEY)!

const dropdownRef = ref<InstanceType<typeof TasksOperationsDropdown>>()

// 注册 Dropdown 执行函数
onMounted(() => {
    if (!dropdownRef.value) return
    dropdownRef.value.register('switch-view-to-table', switchViewTypeToTable)
    dropdownRef.value.register('switch-view-to-kanban', switchViewTypeToKanban)
    dropdownRef.value.register('switch-view-to-list', switchViewTypeToList)
    dropdownRef.value.register('refresh-data', () => subscriber.emit('RefreshData'))
    dropdownRef.value.register('hide-completed', builtInProjectHandlers.switchCompletedTaskDisplay)
    // dropdownRef.value.register('update-preference', () => builtInProjectHandlers.updatePreference())
})
</script>

<template>
    <tasks-operations-dropdown v-if="preference" ref="dropdownRef">
        <div-block title="视图切换">
            <inner-dropdown-option
                icon="table"
                title="表格视图"
                execute-id="switch-view-to-table"
                :checked="preference.viewType === 'table'"
            />
            <!-- <inner-dropdown-option
                icon="kanban"
                title="看板视图"
                execute-id="switch-view-to-kanban"
                :checked="viewContext.preference.value!.viewType === 'kanban'"
            />
            <inner-dropdown-option
                icon="list"
                title="列表视图"
                execute-id="switch-view-to-list"
                :checked="viewContext.preference.value!.viewType === 'list'"
            /> -->
        </div-block>
        <nue-divider />
        <div-block title="视图操作">
            <inner-dropdown-option icon="refresh" title="重新获取数据" execute-id="refresh-data" />
            <inner-dropdown-option
                :icon="isHideCompletedAlready ? 'eye' : 'eye-close'"
                :title="isHideCompletedAlready ? '显示已完成' : '隐藏已完成'"
                execute-id="hide-completed"
            />
            <column-display-operator
                :columns="preference.columns"
                :label-getter="getColumnLabel"
                @update="builtInProjectHandlers.updateColumns"
            />
            <inner-dropdown-option
                icon="picture"
                title="保存视图偏好"
                execute-id="update-preference"
            />
        </div-block>
    </tasks-operations-dropdown>
</template>

