<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'
import { TaskOperationsDropdown, TaskColumnDisplayController } from '@nao-todo/presentation/task'
import { InnerDropdownOption, DropdownDivBlock, TAG_UPDATER_DIALOG_KEY } from '@nao-todo/shared'
import { TAG_VIEW_CONTEXT_KEY } from '../context'

defineOptions({ name: 'TasksTagOperationsDropdown' })

const {
    tag,
    subscriber,
    preference,
    switchViewTypeToTable,
    switchViewTypeToKanban,
    switchViewTypeToList,
    tagHandler,
    isHideCompletedAlready,
    getColumnLabel,
    dialogManager,
    tagUseCase
} = inject(TAG_VIEW_CONTEXT_KEY)!

const dropdownRef = ref<InstanceType<typeof TaskOperationsDropdown>>()

// 注册 Dropdown 执行函数
onMounted(() => {
    if (!dropdownRef.value) return
    dropdownRef.value.register('switch-view-to-table', switchViewTypeToTable)
    dropdownRef.value.register('switch-view-to-kanban', switchViewTypeToKanban)
    dropdownRef.value.register('switch-view-to-list', switchViewTypeToList)
    dropdownRef.value.register('refresh-data', () => subscriber.emit('RefreshData'))
    dropdownRef.value.register('hide-completed', () => tagHandler.switchCompletedTaskDisplay())
    dropdownRef.value.register('save-preference', () => subscriber.emit('UpdatePreference'))
    dropdownRef.value.register('delete-tag', () => {
        if (!tag.value) return
        tagUseCase.delete(tag.value.id)
    })
    dropdownRef.value.register('update-tag', () => {
        if (!tag.value) return
        dialogManager.open(TAG_UPDATER_DIALOG_KEY, tag.value.id)
    })
})
</script>

<template>
    <task-operations-dropdown v-if="preference" ref="dropdownRef">
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
            <task-column-display-controller
                :columns="preference.columns"
                :label-getter="getColumnLabel"
                @update="(k, v) => tagHandler.updateColumns(k, v)"
            />
            <inner-dropdown-option
                icon="picture"
                title="保存视图偏好"
                execute-id="save-preference"
            />
        </dropdown-div-block>
        <nue-divider />
        <dropdown-div-block title="标签操作">
            <inner-dropdown-option icon="edit" title="修改标签" execute-id="update-tag" />
            <inner-dropdown-option
                color="red"
                icon="clear"
                title="删除标签"
                execute-id="delete-tag"
            />
        </dropdown-div-block>
    </task-operations-dropdown>
</template>