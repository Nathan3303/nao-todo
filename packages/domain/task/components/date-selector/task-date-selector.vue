<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { TaskRemindSetter } from '../remind-setter'
import type { TaskDateSelectorProps, TaskDateSelectorEmits } from './types'
import type { TaskRemindSetterUpdateVO } from '../remind-setter/types'

defineOptions({ name: 'TaskDateSelector', inheritAttrs: false })
const props = defineProps<TaskDateSelectorProps>()
const emit = defineEmits<TaskDateSelectorEmits>()

// @ref 组件日期
const date = ref<string>('')

// @ref 待处理提醒更新VO
const pendingRemindUpdate = ref<TaskRemindSetterUpdateVO | null>(null)

// @computed 是否过期
const isExpired = computed(() => {
    if (!props.modelValue) return false
    return dayjs(props.modelValue).isBefore(dayjs())
})

// @computed 日期选择器主题
const datePickerTheme = computed(() => {
    return { small: true, expired: props.colored && isExpired.value }
})

/**
 * 计算日期
 * @description 根据 modelValue 计算日期，返回 ISO 格式的日期字符串
 */
const calculateDate = (newValue: string | null) => {
    if (!newValue) return ''
    const dayjsDate = dayjs(newValue)
    if (!dayjsDate.isValid()) return ''
    return dayjsDate.toISOString()
}

/**
 * 处理提醒更新
 * @param vo 提醒更新VO
 */
const handleRemindUpdate = (vo: TaskRemindSetterUpdateVO) => {
    // 判断属性值是否相同
    const isRemindAtSame = vo.remindAt === props.task?.remindAt
    const isRemindRepeatSame = vo.remindRepeat === props.task?.remindRepeat
    const isRemindTimeSame = vo.remindTime === props.task?.remindTime
    const isRemindWeekdaysSame =
        vo.remindWeekdays?.toString() === props.task?.remindWeekdays?.toString()
    // 如果所有属性值都相同，不更新 pendingRemindUpdate
    if (isRemindAtSame && isRemindRepeatSame && isRemindTimeSame && isRemindWeekdaysSame) return
    // 更新 pendingRemindUpdate
    pendingRemindUpdate.value = vo
}

/**
 * 处理关闭
 * @description 关闭日期选择器时，判断是否有日期变化，如果有则更新 modelValue 和 change 事件
 */
const handleClose = () => {
    const dayjsDate = dayjs(date.value)
    const dateChanged = !dayjsDate.isSame(dayjs(props.modelValue))
    const remindChanged = pendingRemindUpdate.value !== null

    // 同时更新？
    if (dateChanged && remindChanged) {
        emit('update-all', {
            endAt: dayjsDate.toISOString(),
            remindAt: pendingRemindUpdate.value!.remindAt,
            remindRepeat: pendingRemindUpdate.value!.remindRepeat,
            remindTime: pendingRemindUpdate.value!.remindTime,
            remindWeekdays: pendingRemindUpdate.value!.remindWeekdays
        })
        pendingRemindUpdate.value = null
        return
    }

    // 分别更新日期和提醒时间
    if (dateChanged) {
        const newValue = dayjsDate.format('YYYY-MM-DDTHH:mm')
        emit('update:modelValue', newValue)
        emit('change', newValue)
    }
    if (pendingRemindUpdate.value) {
        emit('remind-change', pendingRemindUpdate.value)
        pendingRemindUpdate.value = null
    }
}

// @watch modelValue 变化时，更新日期选择器日期
watch(
    () => props.modelValue,
    (newValue) => (date.value = calculateDate(newValue)),
    { immediate: true }
)
</script>

<template>
    <nue-date-picker
        :theme="datePickerTheme"
        v-model="date"
        type="datetime"
        clearable
        @close="handleClose"
        size="small"
    >
        <template #footer>
            <task-remind-setter :task="task" :date="date" @update="handleRemindUpdate" />
        </template>
    </nue-date-picker>
</template>

<style scoped>
.nue-date-picker:deep() .nue-button {
    background-color: var(--nue-primary-color-0);
    border-color: var(--nue-primary-color-200);
    color: var(--nue-primary-color-900);

    &:hover {
        border-color: var(--nue-primary-color-300);
    }
}

.nue-date-picker--expired:deep() .nue-button {
    background-color: var(--nue-error-color-10);
    border-color: var(--nue-error-color-30);
    color: var(--nue-error-color-50);

    &:hover {
        border-color: var(--nue-error-color-40);
    }
}
</style>
