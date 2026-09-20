<script setup lang="ts">
import { TaskCheckButton, t } from '@nao-todo/shared'
import { TaskDateSelector } from '../../date-selector'
import { inject, ref } from 'vue'
import type { UpdateTaskViewObject } from '@nao-todo/domain-task'
import { TASK_DETAILS_CONTEXT_KEY } from '../context'
import TaskExportDialog from '../export-dialog.vue'
import useExportTask from '../use-export-task'

const emit = defineEmits<{ (e: 'reload'): void }>()

const { vo, refreshKey, closeDetails, updateTaskDetails } = inject(TASK_DETAILS_CONTEXT_KEY)!

// @hook 导出任务文本（Markdown）
const { exporting, markdown, exportTask, copyMarkdown } = useExportTask()
const exportVisible = ref(false)

const handleExport = async () => {
    const text = await exportTask()
    if (text !== null) exportVisible.value = true
}

const handleCopy = () => void copyMarkdown(markdown.value)

const switchState = () => {
    if (vo.value === null) return
    updateTaskDetails(vo.value.id, { state: vo.value.isDone ? 'todo' : 'done' })
}

const updateDateAndRemind = (updateVO: UpdateTaskViewObject) => {
    if (vo.value === null) return
    updateTaskDetails(vo.value.id, updateVO)
}
</script>

<template>
    <nue-header v-if="vo">
        <nue-div theme="left">
            <task-check-button :is-done="vo.isDone" @change="switchState" />
            <task-date-selector
                :colored="!vo.isDone"
                :start-at="vo.startAt"
                :end-at="vo.endAt"
                :task="vo"
                :refresh-key="refreshKey"
                @update-all="updateDateAndRemind"
            />
        </nue-div>
        <nue-div align="center" gap="0">
            <!-- <nue-button-group>
                <nue-button icon="refresh" theme="icon,small" />
            </nue-button-group> -->
            <nue-button
                icon="files"
                theme="icon,small"
                :loading="exporting"
                :title="t('task.details.export.button')"
                @click="handleExport"
            >
                {{ t('task.details.export.button') }}
            </nue-button>
            <nue-button icon="clear" theme="icon,small" @click="closeDetails">
                {{ t('task.details.close') }}
            </nue-button>
        </nue-div>
    </nue-header>
    <task-export-dialog
        v-model="exportVisible"
        :markdown="markdown"
        :loading="exporting"
        @copy="handleCopy"
    />
</template>

<style scoped>
.nue-header {
    padding: 1rem;
    width: 100%;
    height: auto;
    align-items: center;
    gap: 0;
    justify-content: space-between;
    flex-wrap: wrap;

    > .nue-div--left {
        align-items: center;
    }
}
</style>