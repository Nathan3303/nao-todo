<script lang="ts" setup>
import {
    type DialogInstanceType,
    TAG_CREATOR_DIALOG_KEY,
    TASK_CREATOR_DIALOG_KEY,
    TaskSelector,
    t,
    useDialogWrapper
} from '@nao-todo/shared'
import dayjs from 'dayjs'
import { computed, onMounted, ref } from 'vue'
import { TaskDateSelector, TaskProjectSelector, TaskTagBar } from '../../'
import { TaskPrioritySelectOptions, TaskStateSelectOptions } from '../../../constants'
import type { CreateTaskViewObject, TaskViewObject } from '@nao-todo/domain-task'
import type { TaskRemindData } from '../../remind-setter/types'
import { TaskCreatorDialogProps } from './types'
import useTaskCreator from './use-creator'

defineOptions({ name: 'TaskCreatorDialog' })
const props = defineProps<TaskCreatorDialogProps>()

const dialogRef = ref<DialogInstanceType>()
// 兜底加载防重标记（加载中重复打开对话框不重复触发 loadProjects/loadTags）
const projectsLoading = ref(false)
const tagsLoading = ref(false)

const {
    states,
    createStates,
    avaliableProjects,
    avaliableTags,
    dialogManager,
    handleCreateTask,
    clearInputsValue,
    handleUpdateDateAndRemind
} = useTaskCreator(props)
const { visible, close: closeDialog } = useDialogWrapper(dialogRef)

const isExpired = computed(() => {
    return states.state !== 'done' && dayjs(states.endAt).isBefore(dayjs())
})

// @computed 提醒数据（透传给日期选择器，供触发按钮文本与提醒设置器回显）
const remindData = computed<TaskRemindData>(() => ({
    remindAt: states.remindAt,
    remindRepeat: states.remindRepeat as TaskRemindData['remindRepeat'],
    remindTime: states.remindTime,
    remindWeekdays: states.remindWeekdays
}))

const open = <T = CreateTaskViewObject>(createTaskOptions?: T) => {
    clearInputsValue()
    if (createTaskOptions) {
        Object.keys(createTaskOptions).forEach((key) => {
            const presetVal = createTaskOptions[key as keyof T]
            if (!presetVal) return
            const targetKey = key as keyof typeof states
            if (targetKey in states) {
                ;(states as Record<string, unknown>)[targetKey] = presetVal
            }
        })
    }
    // 数据就绪兜底：清单/标签 store 为空时触发加载（store 为响应式，数据到后下拉自动填充）
    // 防重：加载中重复打开对话框不重复触发（loadProjects/loadTags 无内部防重）
    if (!avaliableProjects.value.length && props.loadProjects && !projectsLoading.value) {
        projectsLoading.value = true
        void props.loadProjects().finally(() => (projectsLoading.value = false))
    }
    if (!avaliableTags.value.length && props.loadTags && !tagsLoading.value) {
        tagsLoading.value = true
        void props.loadTags().finally(() => (tagsLoading.value = false))
    }
    visible.value = true
}

const close = () => {
    closeDialog()
    createStates.disabled = false
}

const submit = () => {
    handleCreateTask().then((ok) => ok && close())
}

onMounted(() => dialogManager.register(TASK_CREATOR_DIALOG_KEY, { open, close }))
</script>

<template>
    <nue-dialog
        :theme="'task-creator'"
        v-model="visible"
        ref="dialogRef"
        :title="t('dialog.taskCreator.title')"
    >
        <template #content>
            <nue-div vertical align="stretch" gap="0.75rem">
                <!-- ═══ 旧模式 ═══ -->
                <nue-input
                    v-model="states.name"
                    clearable
                    :placeholder="t('dialog.taskCreator.namePlaceholder')"
                    maxlength="64"
                    counter="word-left"
                />
                <nue-textarea
                    v-model="states.description"
                    maxlength="256"
                    counter="word-left"
                    :autosize="{ minRows: 1, maxRows: 4 }"
                    :placeholder="t('dialog.taskCreator.descPlaceholder')"
                    theme="fix-padding"
                />
                <nue-div align="center" gap="0.5rem">
                    <task-date-selector
                        :colored="!isExpired"
                        :start-at="states.startAt"
                        :end-at="states.endAt"
                        :remind="remindData"
                        @update-all="handleUpdateDateAndRemind"
                    />
                </nue-div>
                <nue-div wrap="wrap" gap=".5rem">
                    <task-selector
                        :options="TaskStateSelectOptions"
                        :value="states.state"
                        @change="(s: unknown) => (states.state = s as TaskViewObject['state'])"
                    />
                    <task-selector
                        :options="TaskPrioritySelectOptions"
                        :value="states.priority"
                        @change="
                            (p: unknown) => (states.priority = p as TaskViewObject['priority'])
                        "
                    />
                    <nue-div flex="1" />
                    <task-project-selector
                        :project-id="states.projectId || ''"
                        :projects="avaliableProjects || []"
                        @select="(pid: string) => (states.projectId = pid)"
                    />
                </nue-div>
                <task-tag-bar
                    :available-tags="avaliableTags || []"
                    :task-tag-ids="states.tags || []"
                    @update-tags="(_tags: unknown) => (states.tags = _tags as string[])"
                    @create-tag="
                        (name: string) => dialogManager.open(TAG_CREATOR_DIALOG_KEY, { name })
                    "
                />
            </nue-div>
        </template>
        <template #footer>
            <nue-div gap="var(--nue-gap-xs)" flex="1" justify="flex-end">
                <nue-button :disabled="createStates.disabled" @click="close">
                    {{ t('common.cancel') }}
                </nue-button>
                <nue-button
                    :disabled="createStates.disabled"
                    :loading="createStates.creating"
                    theme="primary"
                    @click="submit"
                >
                    {{ t('common.create') }}
                </nue-button>
            </nue-div>
        </template>
    </nue-dialog>
</template>

<style>
.nue-dialog--task-creator {
    width: 24rem;
}
</style>