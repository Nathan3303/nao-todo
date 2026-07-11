<script setup lang="ts">
import { DropdownDivBlock, InnerDropdownOption, TaskProjectSelector } from '@nao-todo/components'
import { inject } from 'vue'
import { TASK_DETAILS_CONTEXT_KEY } from '../context'
import { t } from '@nao-todo/infrastructure/locales'
import { PARENT_TASK_SELECTOR_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'
import type { TaskViewObject } from '@nao-todo/usecases/task'

const { vo, projects, isCommenting, taskHandler, switchTaskDetails, dialogManager } =
    inject(TASK_DETAILS_CONTEXT_KEY)!

const openParentTaskSelector = () => {
    if (!vo.value) return
    dialogManager.open(PARENT_TASK_SELECTOR_DIALOG_KEY, {
        currentTaskId: vo.value.id,
        onSelect: (parentTaskId: TaskViewObject['id']) => {
            if (!vo.value) return
            taskHandler.update(vo.value.id, { parentTaskId })
        }
    })
}

const handleDropdownExecute = async (executeId: string) => {
    if (!vo.value) return
    switch (executeId) {
        case 'comment-todo':
            isCommenting.value = true
            break
        case 'copy-todo':
            await taskHandler.copyTask(vo.value.id, (taskViewObject) => {
                switchTaskDetails(taskViewObject.id)
            })
            break
        case 'move-to-subtask':
            openParentTaskSelector()
            break
        case 'delete-todo':
            await taskHandler.delete(vo.value.id)
            break
        case 'restore-todo':
            await taskHandler.restore(vo.value.id)
            break
        case 'giveup-todo':
            await taskHandler.giveUp(vo.value.id)
            break
        case 'un-giveup-todo':
            await taskHandler.unGiveUp(vo.value.id)
            break
    }
}
</script>

<template>
    <nue-footer>
        <nue-div v-if="vo" align="center" justify="space-between" width="100%">
            <task-project-selector
                :project-id="vo.projectId || ''"
                :projects="projects"
                placement="top-start"
                @select="(npId) => taskHandler.update(vo!.id, { projectId: npId })"
            />
            <nue-dropdown
                theme="menu"
                close-when-executed
                placement="top-end"
                @execute="handleDropdownExecute"
            >
                <template #trigger="{ trigger }">
                    <nue-button icon="more" theme="small" @click="trigger">{{
                        t('common.more')
                    }}</nue-button>
                </template>
                <dropdown-div-block :title="t('task.details.moreOperations')">
                    <inner-dropdown-option
                        :title="t('task.details.addComment')"
                        icon="chat"
                        execute-id="comment-todo"
                    />
                    <inner-dropdown-option
                        :title="t('task.details.copyTask')"
                        icon="files"
                        execute-id="copy-todo"
                    />
                    <inner-dropdown-option
                        :title="t('task.details.moveToSubTask')"
                        icon="connection"
                        execute-id="move-to-subtask"
                    />
                </dropdown-div-block>
                <nue-divider />
                <dropdown-div-block :title="t('task.details.deleteOrGiveUp')">
                    <inner-dropdown-option
                        :disabled="vo.isDeleted"
                        :title="
                            vo.isGivenUp ? t('task.details.ungiveUp') : t('task.details.giveUp')
                        "
                        :icon="vo.isGivenUp ? 'restore' : 'clear'"
                        :execute-id="vo.isGivenUp ? 'un-giveup-todo' : 'giveup-todo'"
                        :theme="vo.isGivenUp ? void 0 : 'orange'"
                    />
                    <inner-dropdown-option
                        :title="
                            vo.isDeleted ? t('task.details.restore') : t('task.details.deleteTask')
                        "
                        :icon="vo.isDeleted ? 'restore' : 'delete'"
                        :execute-id="vo.isDeleted ? 'restore-todo' : 'delete-todo'"
                        :theme="vo.isDeleted ? void 0 : 'red'"
                    />
                </dropdown-div-block>
            </nue-dropdown>
        </nue-div>
    </nue-footer>
</template>

