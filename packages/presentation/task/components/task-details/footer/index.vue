<script setup lang="ts">
import { DropdownDivBlock } from '@nao-todo/shared/components/dropdown-div-block'
import { InnerDropdownOption } from '@nao-todo/shared/components/inner-dropdown'
import { PARENT_TASK_SELECTOR_DIALOG_KEY } from '@nao-todo/shared/constants'
import { t } from '@nao-todo/shared/locales'
import { TaskProjectSelector } from '../../project-selector'
import { computed, inject, nextTick, ref, watch, type ComponentPublicInstance } from 'vue'
import dayjs from 'dayjs'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { TASK_DETAILS_CONTEXT_KEY, TASK_HISTORY_CONTEXT_KEY } from '../context'
import TaskExportDialog from '../export-dialog.vue'
import TaskHistoryDialog from '../task-history-dialog.vue'
import useExportTask from '../use-export-task'

const {
    vo,
    projects,
    readOnly: readOnlyRef,
    isCommenting,
    taskHandler,
    switchTaskDetails,
    dialogManager,
    beginEdit,
    updateTaskDetails,
    deleteTask,
    restoreTask,
    giveUpTask,
    ungiveUpTask,
    isProjectArchived
} = inject(TASK_DETAILS_CONTEXT_KEY)!

/** 只读态（`T795`）：上下文可缺省（缺失按「可编辑」，同 `isProjectArchived` 先例） */
const isReadOnly = computed(() => readOnlyRef?.value === true)
// @hook 导出任务文本（Markdown / JSON / HTML 单据）
const { status, markdown, json, html, error, startExport, retry, reset, copyMarkdown } =
    useExportTask()
const exportVisible = ref(false)
const exportFormat = ref('markdown')

// 打开即取数（loading → ready | error）；关闭重置（清缓存、回 idle）
watch(exportVisible, (visible) => {
    if (visible) void startExport()
    else reset()
})

// 复制对话框内「编辑后」文本（AC2）；对话框未编辑时即本次生成文本
const handleCopy = (text: string) => void copyMarkdown(text)

// @context 变更历史数据源（A 档审计日志 · T712）：缺失 ⇒ 菜单项与对话框都不渲染
// （与旧内联面板同一守卫口径：未接线端不出现死入口）
const historyProvider = inject(TASK_HISTORY_CONTEXT_KEY, null)
const historyVisible = ref(false)
/** 「更多」触发按钮：对话框关闭后焦点归还于此（`R-10` / AC12） */
const moreTriggerRef = ref<ComponentPublicInstance | null>(null)

watch(historyVisible, (visible) => {
    if (visible) return
    // Esc / × / 底部按钮三路关闭统一在此归还焦点（菜单项随下拉关闭已卸载，故归还常驻的触发按钮）
    void nextTick(() => {
        const el = moreTriggerRef.value?.$el
        if (el instanceof HTMLElement) el.focus()
    })
})

const openParentTaskSelector = () => {
    if (!vo.value) return
    // DEF-153：打开选择器 = 交互起点 ⇒ 冻结 parentTaskId 基准
    beginEdit('parentTaskId')
    dialogManager.open(PARENT_TASK_SELECTOR_DIALOG_KEY, {
        currentTaskId: vo.value.id,
        onSelect: (parentTaskId: TaskViewObject['id']) => {
            if (!vo.value) return
            updateTaskDetails(vo.value.id, { parentTaskId })
        }
    })
}

/**
 * 所属清单是否归档（`T768` 只读判据）
 * @description `isProjectArchived` 由装配层提供（缺失按「未归档」处理）；
 *              在 computed 内调用 ⇒ 对 pinia 清单状态的读取会被依赖追踪，
 *              清单取消归档后两个入口即时恢复。
 */
const isProjectArchivedByVo = computed(() => {
    const projectId = vo.value?.projectId ?? ''
    if (projectId === '' || typeof isProjectArchived !== 'function') return false
    return isProjectArchived(projectId)
})

/**
 * 只读（`T795`）下「更多」里**唯一可用的写动作** = 取消归档（逃生口）；
 * 其余编辑类动作在模板里统一 disabled，此处再兜一层（键盘 / 程序化触发）。
 */
const READ_ONLY_ALLOWED_ACTIONS = new Set(['unarchive-todo', 'history', 'export-task'])

const handleDropdownExecute = async (executeId: string) => {
    if (!vo.value) return
    if (isReadOnly.value && !READ_ONLY_ALLOWED_ACTIONS.has(executeId)) return
    switch (executeId) {
        case 'star-mark':
            // DEF-153：动作点击 = 交互起点 ⇒ 冻结 starMarkAt 基准（此刻 vo.starMarkAt 仍是旧值）
            beginEdit('starMarkAt')
            await updateTaskDetails(vo.value.id, { starMarkAt: dayjs().toISOString() })
            break
        case 'un-star-mark':
            beginEdit('starMarkAt')
            await updateTaskDetails(vo.value.id, { starMarkAt: '' })
            break
        case 'comment-todo':
            if (isReadOnly.value) break
            isCommenting.value = true
            break
        case 'copy-todo':
            await taskHandler.copyTask(vo.value.id, (taskViewObject) => {
                switchTaskDetails(taskViewObject.id)
            })
            break
        case 'export-task': {
            // 流程反转（PRD §5.1）：立即开框，取数由框内 LoadingError 触发
            exportVisible.value = true
            break
        }
        case 'history':
            // D8 / R-10：入口收进「更多」，以对话框呈现（正文不再内联）
            historyVisible.value = true
            break
        case 'move-to-subtask':
            openParentTaskSelector()
            break
        case 'delete-todo':
            await deleteTask(vo.value.id)
            break
        case 'restore-todo':
            await restoreTask(vo.value.id)
            break
        case 'giveup-todo':
            await giveUpTask(vo.value.id)
            break
        case 'un-giveup-todo':
            await ungiveUpTask(vo.value.id)
            break
        case 'unarchive-todo':
            await taskHandler.unarchiveTask(vo.value.id)
            break
        case 'archive-todo':
            await taskHandler.archiveTask(vo.value.id)
            break
    }
}
</script>

<template>
    <nue-footer v-if="vo">
        <task-project-selector
            :project-id="vo.projectId || ''"
            :projects="projects"
            placement="top-start"
            :disabled="isReadOnly"
            @select="
                (npId) => (isReadOnly ? undefined : taskHandler.update(vo!.id, { projectId: npId }))
            "
        />
        <nue-dropdown
            theme="menu"
            close-when-executed
            placement="top-end"
            @execute="handleDropdownExecute"
        >
            <template #trigger="{ trigger }">
                <nue-button ref="moreTriggerRef" icon="more" theme="small" @click="trigger">
                    {{ t('common.more') }}
                </nue-button>
            </template>
            <dropdown-div-block :title="t('task.details.moreOperations')">
                <!--
                    归档 / 取消归档互斥（`T768`）：
                    · 清单已归档 ⇒ 其内任务只读 ⇒ 两项都不提供（改为一条可读的只读说明）；
                    · 已归档 ⇒ 只给「取消归档」（ADR §15.1 逃生口）；
                    · 子任务 ⇒ 不提供「归档此任务」（父任务归档即覆盖其可见性）。
                -->
                <inner-dropdown-option
                    v-if="isProjectArchivedByVo"
                    disabled
                    :title="t('archive.readOnlyHint')"
                    icon="lock"
                />
                <inner-dropdown-option
                    v-else-if="vo.archivedAt"
                    :title="t('task.details.unarchive')"
                    icon="archive"
                    execute-id="unarchive-todo"
                />
                <inner-dropdown-option
                    v-else-if="!vo.parentTaskId"
                    :disabled="vo.isDeleted"
                    :title="t('task.details.archive')"
                    icon="archive"
                    execute-id="archive-todo"
                />
                <inner-dropdown-option
                    :disabled="vo.isDeleted || isReadOnly"
                    :title="
                        vo.isStarMarked ? t('task.details.unfavorite') : t('task.details.favorite')
                    "
                    :icon="vo.isStarMarked ? 'heart-fill' : 'heart'"
                    :checked="vo.isStarMarked"
                    :execute-id="vo.isStarMarked ? 'un-star-mark' : 'star-mark'"
                />
                <inner-dropdown-option
                    :disabled="isReadOnly"
                    :title="t('task.details.addComment')"
                    icon="chat"
                    execute-id="comment-todo"
                />
                <inner-dropdown-option
                    :disabled="isReadOnly"
                    :title="t('task.details.copyTask')"
                    icon="files"
                    execute-id="copy-todo"
                />
                <inner-dropdown-option
                    :title="t('task.details.export.button')"
                    icon="share"
                    execute-id="export-task"
                />
                <inner-dropdown-option
                    v-if="historyProvider"
                    :title="t('history.title')"
                    icon="time"
                    execute-id="history"
                />
                <inner-dropdown-option
                    :disabled="isReadOnly"
                    :title="t('task.details.moveToSubTask')"
                    icon="connection"
                    execute-id="move-to-subtask"
                />
            </dropdown-div-block>
            <nue-divider v-if="!isReadOnly" />
            <dropdown-div-block v-if="!isReadOnly" :title="t('task.details.deleteOrGiveUp')">
                <inner-dropdown-option
                    :disabled="vo.isDeleted"
                    :title="vo.isGivenUp ? t('task.details.ungiveUp') : t('task.details.giveUp')"
                    :icon="vo.isGivenUp ? 'restore' : 'clear'"
                    :execute-id="vo.isGivenUp ? 'un-giveup-todo' : 'giveup-todo'"
                    :theme="vo.isGivenUp ? void 0 : 'orange'"
                />
                <inner-dropdown-option
                    :title="vo.isDeleted ? t('task.details.restore') : t('task.details.deleteTask')"
                    :icon="vo.isDeleted ? 'restore' : 'delete'"
                    :execute-id="vo.isDeleted ? 'restore-todo' : 'delete-todo'"
                    :theme="vo.isDeleted ? void 0 : 'red'"
                />
            </dropdown-div-block>
        </nue-dropdown>
    </nue-footer>
    <task-export-dialog
        v-model="exportVisible"
        v-model:format="exportFormat"
        :markdown="markdown"
        :status="status"
        :json="json"
        :html="html"
        :error-message="error"
        @retry="retry"
        @copy="handleCopy"
    />
    <task-history-dialog v-if="historyProvider" v-model="historyVisible" :task-id="vo?.id ?? ''" />
</template>

<style scoped>
.nue-footer {
    padding: 1rem;
    height: auto;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid var(--nue-border-color);
}
</style>