<script setup lang="ts">
import { inject } from 'vue'
import { InnerDropdownOption, TaskProjectSelector, DropdownDivBlock } from '@nao-todo/components'
import { TASK_DETAILS_CONTEXT_KEY } from '../constants'
import type { TaskDetailsContext } from '../types'

const { vo, emit, projects, isCommenting, taskHandler } =
    inject<TaskDetailsContext>(TASK_DETAILS_CONTEXT_KEY)!

const handleDropdownExecute = async (executeId: string) => {
    if (!vo.value) return
    switch (executeId) {
        case 'comment-todo':
            isCommenting.value = true
            break
        case 'duplicate-todo':
            emit('duplicateTask', vo.value.id)
            break
        case 'delete-todo':
            await taskHandler.deleteTask(vo.value.id)
            break
        case 'restore-todo':
            await taskHandler.restoreTask(vo.value.id)
            break
    }
}

const updateProjectId = (npId: string) => {
    if (!vo.value) return
    taskHandler.updateTask(vo.value.id, { projectId: npId })
}
</script>

<template>
    <nue-footer>
        <nue-div v-if="vo" align="center" justify="space-between" width="100%">
            <task-project-selector
                :project-id="vo.projectId"
                :projects="projects"
                placement="top-start"
                @select="updateProjectId"
            />
            <nue-dropdown
                close-when-executed
                placement="top-end"
                @execute="handleDropdownExecute"
                theme="small"
            >
                <template #trigger="{ trigger }">
                    <nue-button icon="more" theme="small" @click="trigger">更多</nue-button>
                </template>
                <dropdown-div-block title="更多操作">
                    <inner-dropdown-option title="添加评论" icon="chat" execute-id="comment-todo" />
                    <inner-dropdown-option
                        title="复制待办任务"
                        icon="files"
                        execute-id="duplicate-todo"
                        disabled
                    />
                </dropdown-div-block>
                <dropdown-div-block title="删除或恢复">
                    <inner-dropdown-option
                        :title="vo.isDeleted ? '恢复待办任务' : '删除待办任务'"
                        :icon="vo.isDeleted ? 'restore' : 'delete'"
                        :execute-id="vo.isDeleted ? 'restore-todo' : 'delete-todo'"
                    />
                </dropdown-div-block>
            </nue-dropdown>
        </nue-div>
    </nue-footer>
</template>

