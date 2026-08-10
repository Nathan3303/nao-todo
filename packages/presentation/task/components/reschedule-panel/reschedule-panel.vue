<script setup lang="ts">
import dayjs from 'dayjs'
import { NueConfirm, NueDropdown, NueMessage } from 'nue-ui'
import { t, unwrapError } from '@nao-todo/shared'
import { ref } from 'vue'
import type { TaskReschedulePanelEmits, TaskReschedulePanelProps } from './types'

defineOptions({ name: 'TaskReschedulePanel' })
const props = defineProps<TaskReschedulePanelProps>()
const emit = defineEmits<TaskReschedulePanelEmits>()

// @ref 重新安排下拉面板
const dropdownRef = ref<InstanceType<typeof NueDropdown>>()

// @state 重新安排日期
const rescheduleDate = ref<string>('')

// @method 打开面板前重置日期
const resetRescheduleDate = () => {
    rescheduleDate.value = ''
}

// @method 确认日期后拉取任务并询问重排
const handleRescheduleConfirm = async () => {
    if (!rescheduleDate.value) return
    dropdownRef.value?.close()
    const endAt = dayjs(rescheduleDate.value).toISOString()
    // 1. 拉取当前视图（overdue）显示的所有任务
    const [res, listError] = await props.taskUseCase.list({
        ...props.getTasksOptions,
        page: 1,
        limit: 1000
    })
    if (listError !== null || !res) {
        NueMessage.error(unwrapError(listError))
        return
    }
    const taskIds = res.taskIds
    if (!taskIds.length) {
        NueMessage.info(t('task.empty.overdue'))
        return
    }
    // 2. 询问用户是否重排
    NueConfirm({
        title: t('task.details.reschedule'),
        content: t('task.details.rescheduleConfirmContent', {
            count: taskIds.length,
            date: dayjs(endAt).format('YYYY-MM-DD HH:mm')
        }),
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        onConfirm: async () => {
            // 3. 批量更新所有任务的 endAt
            const updates = taskIds.map((id) => ({ id, endAt }))
            const [succeeded, batchError] = await props.taskUseCase.batchUpdate(updates)
            if (batchError !== null) {
                NueMessage.error(t('task.details.rescheduleFailed'))
                return
            }
            NueMessage.success(t('task.details.rescheduleSuccess', { count: succeeded }))
            // 4. 通知父级刷新列表（重排后任务不再属于 overdue 视图）
            emit('refresh')
        }
    })
}
</script>

<template>
    <nue-dropdown
        ref="dropdownRef"
        theme="reschedule-panel"
        placement="bottom-center"
        @before-open="resetRescheduleDate"
    >
        <!-- 触发按钮 -->
        <template #trigger="{ trigger }">
            <nue-tooltip :content="t('task.details.reschedule')" size="small">
                <nue-button icon="calendar" theme="icon,ghost" @click="trigger" />
            </nue-tooltip>
        </template>
        <!-- 下拉面板 -->
        <nue-div class="reschedule-panel">
            <nue-div class="reschedule-panel__header">
                <nue-icon name="time" class="reschedule-panel__header-icon" />
                <nue-text class="reschedule-panel__title">
                    {{ t('task.details.reschedule') }}
                </nue-text>
            </nue-div>
            <nue-text class="reschedule-panel__desc">
                {{ t('task.details.rescheduleDescription') }}
            </nue-text>
            <nue-divider />
            <nue-div class="reschedule-panel__actions">
                <nue-date-picker
                    v-model="rescheduleDate"
                    class="reschedule-panel__picker"
                    type="datetime"
                    clearable
                    size="small"
                    style="margin-right: auto"
                />
                <nue-button theme="small" @click="dropdownRef?.close()">
                    {{ t('common.cancel') }}
                </nue-button>
                <nue-button
                    :disabled="!rescheduleDate"
                    theme="primary,small"
                    @click="handleRescheduleConfirm"
                >
                    {{ t('task.details.reschedule') }}
                </nue-button>
            </nue-div>
        </nue-div>
    </nue-dropdown>
</template>

<style>
/* 重新安排下拉面板（NueDropdown 内容经 Teleport 渲染至 body，需全局样式） */
.nue-dropdown--reschedule-panel {
    min-width: 22rem;
    padding: var(--nue-padding-sm);
    border-radius: var(--nue-primary-radius);

    .reschedule-panel {
        display: flex;
        flex-direction: column;
        gap: var(--nue-gap-xs);
        color: var(--nue-primary-color-900);

        .reschedule-panel__header {
            display: flex;
            align-items: center;
            gap: var(--nue-gap-xs);

            .reschedule-panel__title {
                font-size: var(--nue-text-sm);
            }
        }

        .reschedule-panel__desc {
            font-size: var(--nue-text-xs);
            line-height: 1.6;
            color: var(--nue-primary-color-600);
        }

        .reschedule-panel__actions {
            display: flex;
            justify-content: flex-end;
            gap: var(--nue-gap-xs);
        }
    }
}
</style>