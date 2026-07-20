<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'
import { TaskOperationsDropdown, TaskColumnDisplayController } from '@nao-todo/presentation/task'
import { InnerDropdownOption, DropdownDivBlock, PROJECT_UPDATER_DIALOG_KEY } from '@nao-todo/shared'
import { PROJECT_VIEW_CONTEXT_KEY } from '../context'

defineOptions({ name: 'TasksProjectOperationsDropdown' })

const {
    projectUseCase,
    project,
    subscriber,
    preference,
    switchViewTypeToTable,
    switchViewTypeToKanban,
    switchViewTypeToList,
    projectHandler,
    isHideCompletedAlready,
    getColumnLabel,
    dialogManager
} = inject(PROJECT_VIEW_CONTEXT_KEY)!

const dropdownRef = ref<InstanceType<typeof TaskOperationsDropdown>>()

// 注册 Dropdown 执行函数
onMounted(() => {
    if (!dropdownRef.value) return
    dropdownRef.value.register('switch-view-to-table', switchViewTypeToTable)
    dropdownRef.value.register('switch-view-to-kanban', switchViewTypeToKanban)
    dropdownRef.value.register('switch-view-to-list', switchViewTypeToList)
    dropdownRef.value.register('refresh-data', () => subscriber.emit('RefreshData'))
    dropdownRef.value.register('hide-completed', () => projectHandler.switchCompletedTaskDisplay())
    dropdownRef.value.register('save-preference', () => subscriber.emit('UpdatePreference'))
    dropdownRef.value.register('delete-project', () => {
        if (!project.value) return
        projectUseCase.delete(project.value.id)
    })
    dropdownRef.value.register('archive-project', () => {
        if (!project.value) return
        projectUseCase.archive(project.value.id)
    })
    dropdownRef.value.register('update-project', () => {
        if (!project.value) return
        dialogManager.open(PROJECT_UPDATER_DIALOG_KEY, project.value.id)
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
                @update="(k, v) => projectHandler.updateColumns(k, v)"
            />
            <inner-dropdown-option
                icon="picture"
                title="保存视图偏好"
                execute-id="save-preference"
            />
        </dropdown-div-block>
        <nue-divider />
        <dropdown-div-block title="清单操作">
            <inner-dropdown-option
                icon="edit"
                title="修改清单名称和描述"
                execute-id="update-project"
            />
            <inner-dropdown-option
                color="red"
                icon="clear"
                title="删除清单"
                execute-id="delete-project"
            />
            <!-- <inner-dropdown-option
                disabled
                icon="archive"
                title="归档清单"
                execute-id="archive-project"
            /> -->
        </dropdown-div-block>
    </task-operations-dropdown>
</template>
