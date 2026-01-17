<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'
import TasksOperationsDropdown from '@/components/tasks/dropdowns/operations-dropdown.vue'
import { InnerDropdownOption, DivBlock } from '@/components/ui'
import ColumnDisplayOperator from '@/components/tasks/dropdowns/column-display-operator.vue'
import { TAG_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { TagViewContext } from '../types'

defineOptions({ name: 'TasksTagOperationsDropdown' })

const viewContext = inject<TagViewContext>(TAG_VIEW_CONTEXT_KEY)

const dropdownRef = ref<InstanceType<typeof TasksOperationsDropdown>>()

// 注册 Dropdown 执行函数
onMounted(() => {
    if (!dropdownRef.value || !viewContext) return
    dropdownRef.value.register('switch-view-to-table', viewContext.switchViewTypeToTable)
    dropdownRef.value.register('switch-view-to-kanban', viewContext.switchViewTypeToKanban)
    dropdownRef.value.register('switch-view-to-list', viewContext.switchViewTypeToList)
    dropdownRef.value.register('refresh-data', () => viewContext.subscriber.emit('RefreshData'))
    dropdownRef.value.register('hide-completed', viewContext.switchHideCompleted)
    dropdownRef.value.register('update-preference', () =>
        viewContext.subscriber.emit('UpdatePreference')
    )
})
</script>

<template>
    <tasks-operations-dropdown v-if="viewContext" ref="dropdownRef">
        <div-block title="视图切换">
            <inner-dropdown-option
                icon="table"
                title="表格视图"
                execute-id="switch-view-to-table"
                :checked="viewContext.preference.value!.viewType === 'table'"
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
                :icon="viewContext.isHideCompletedAlready.value ? 'eye' : 'eye-close'"
                :title="viewContext.isHideCompletedAlready.value ? '显示已完成' : '隐藏已完成'"
                execute-id="hide-completed"
            />
            <column-display-operator
                :columns="viewContext.preference.value!.columns"
                :label-getter="viewContext.getColumnLabel"
                @update="viewContext.tagHandlers.updateColumns"
            />
            <inner-dropdown-option
                icon="picture"
                title="保存视图偏好"
                execute-id="update-preference"
            />
        </div-block>
    </tasks-operations-dropdown>
</template>

