<script setup lang="ts">
import dayjs from 'dayjs'
import { NueDropdown } from 'nue-ui'
import { parse2RelativeDate, t } from '@nao-todo/shared'
import { computed, ref } from 'vue'
import type { UpdateTaskViewObject } from '@nao-todo/domain-task'
import { TaskRemindSetter } from '../remind-setter'
import type { TaskRemindSetterUpdateVO } from '../remind-setter/types'
import type { TaskDateSelectorEmits, TaskDateSelectorProps } from './types'

defineOptions({ name: 'TaskDateSelector', inheritAttrs: false })
const props = defineProps<TaskDateSelectorProps>()
const emit = defineEmits<TaskDateSelectorEmits>()

// @ref 下拉面板
const dropdownRef = ref<InstanceType<typeof NueDropdown>>()

// @state 本地日期与待提交提醒
const startAtLocal = ref<string>('')
const endAtLocal = ref<string>('')
const pendingRemindUpdate = ref<TaskRemindSetterUpdateVO | null>(null)
const remindSetterKey = ref(0)

// @computed 结束时间是否过期（colored 时高亮）
const isEndExpired = computed(() => {
    const { endAt, refreshKey } = props
    if (!endAt) return false
    return refreshKey && dayjs(endAt).isBefore(dayjs())
})
const endPickerTheme = computed(() => ({ small: true, expired: isEndExpired.value }))

// @computed trigger 按钮文本：开始 ~ 结束 + 简要提醒
const triggerText = computed(() => {
    const start = props.startAt ? parse2RelativeDate(props.startAt) : ''
    const end = props.endAt ? parse2RelativeDate(props.endAt) : ''
    let range: string = ''
    if (start && end) {
        range = `${start} ~ ${end}`
    } else if (start) {
        range = t('task.details.startedAt', { time: start })
    } else if (end) {
        range = t('task.details.dueAt', { time: end })
    }
    const hasReminder = props.task && props.task.remindAt !== null && props.task.remindTime !== null
    const remind =
        hasReminder && props.task?.remindTime
            ? t('task.details.remindAt', { time: props.task.remindTime })
            : ''
    return { range: range || t('task.details.setTime'), remind }
})

// @method 打开面板前重置本地状态（并按 key 重挂载提醒设置器）
const handleBeforeOpen = () => {
    startAtLocal.value = props.startAt || ''
    endAtLocal.value = props.endAt || ''
    pendingRemindUpdate.value = null
    remindSetterKey.value++
}

// @method 提醒设置变更缓存
const handleRemindUpdate = (vo: TaskRemindSetterUpdateVO) => {
    pendingRemindUpdate.value = vo
}

// @method 保存：构建变更并提交后关闭
const handleSave = () => {
    const normalize = (v: string | null | undefined) => (v ? dayjs(v).toISOString() : '')
    const updateVO: UpdateTaskViewObject = {}
    if (normalize(startAtLocal.value) !== normalize(props.startAt)) {
        updateVO.startAt = startAtLocal.value ? dayjs(startAtLocal.value).toISOString() : null
    }
    if (normalize(endAtLocal.value) !== normalize(props.endAt)) {
        updateVO.endAt = endAtLocal.value ? dayjs(endAtLocal.value).toISOString() : null
    }
    if (pendingRemindUpdate.value) {
        Object.assign(updateVO, pendingRemindUpdate.value)
    }
    dropdownRef.value?.close()
    if (Object.keys(updateVO).length > 0) {
        emit('update-all', updateVO)
    }
}

// @method 取消：关闭且不提交
const handleCancel = () => {
    dropdownRef.value?.close()
}
</script>

<template>
    <nue-dropdown ref="dropdownRef" placement="bottom-start" @before-open="handleBeforeOpen">
        <!-- 触发按钮 -->
        <template #trigger="{ trigger }">
            <nue-button :theme="{ small: true, expired: isEndExpired }" @click="trigger">
                <nue-div
                    gap="var(--nue-gap-2xs)"
                    :divider="triggerText.remind ? ',' : null"
                    align="center"
                >
                    <nue-text>{{ triggerText.range }}</nue-text>
                    <nue-text
                        v-if="triggerText.remind"
                        size="var(--nue-text-xs)"
                        color="var(--nue-primary-color-500)"
                    >
                        {{ triggerText.remind }}
                    </nue-text>
                </nue-div>
            </nue-button>
        </template>
        <!-- 下拉面板 -->
        <nue-div class="task-date-selector-panel">
            <!-- 日期设置 -->
            <nue-div class="task-date-selector-panel__row">
                <nue-text size="var(--nue-text-xs)">
                    {{ t('task.details.startTime') }}
                </nue-text>
                <nue-date-picker
                    v-model="startAtLocal"
                    type="datetime"
                    clearable
                    size="small"
                    :placeholder="t('task.details.startTimePlaceholder')"
                />
            </nue-div>
            <nue-div class="task-date-selector-panel__row">
                <nue-text size="var(--nue-text-xs)">
                    {{ t('task.details.endTime') }}
                </nue-text>
                <nue-date-picker
                    v-model="endAtLocal"
                    :theme="endPickerTheme"
                    type="datetime"
                    clearable
                    size="small"
                    :placeholder="t('task.details.endTimePlaceholder')"
                />
            </nue-div>
            <nue-divider />
            <!-- 提醒设置 -->
            <task-remind-setter :key="remindSetterKey" :task="task" @update="handleRemindUpdate" />
            <nue-divider />
            <!-- 操作区 -->
            <nue-div class="task-date-selector-panel__actions">
                <nue-button theme="small" @click="handleCancel">
                    {{ t('common.cancel') }}
                </nue-button>
                <nue-button theme="primary,small" @click="handleSave">
                    {{ t('common.save') }}
                </nue-button>
            </nue-div>
        </nue-div>
    </nue-dropdown>
</template>

<style scoped>
.nue-dropdown-wrapper .nue-button--expired {
    --nue-button-base-color: var(--nue-error-color-20);
    --nue-button-color: var(--nue-error-color-90);
}
</style>

<style>
/* 任务日期选择器下拉面板（NueDropdown 内容经 Teleport 渲染至 body，需全局样式） */
.task-date-selector-panel {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-xs);
    width: 16rem;
    color: var(--nue-primary-color-900);
    padding: var(--nue-padding-2xs) 0;

    .task-date-selector-panel__row {
        display: flex;
        flex-direction: column;
        align-items: start;
        justify-content: space-between;
        gap: var(--nue-gap-2xs);

        > .nue-text {
            color: var(--nue-primary-color-500);
            flex: none;
        }
    }

    .task-date-selector-panel__actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--nue-gap-2xs);

        .nue-button {
            flex: 1;
        }
    }

    .nue-button--expired {
        --nue-button-base-color: var(--nue-error-color-20);
        --nue-button-color: var(--nue-error-color-90);
    }
}
</style>