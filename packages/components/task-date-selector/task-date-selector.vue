<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { TaskRemindSetter } from '../task-remind-setter'
import type { TaskDateSelectorProps, TaskDateSelectorEmits } from './types'
import type { TaskRemindSetterUpdateVO } from '../task-remind-setter/types'

defineOptions({ name: 'TaskDateSelector', inheritAttrs: false })
const props = defineProps<TaskDateSelectorProps>()
const emit = defineEmits<TaskDateSelectorEmits>()

const date = ref(props.modelValue ? dayjs(props.modelValue).format('YYYY-MM-DD HH:mm') : '')

watch(
    () => props.modelValue,
    (val) => (date.value = val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '')
)

const isExpired = computed(() => {
    if (!props.modelValue) return false
    return dayjs(props.modelValue).isBefore(dayjs())
})

const datePickerTheme = computed(() => {
    return { small: true, expired: props.colored && isExpired.value }
})

const pendingRemindUpdate = ref<TaskRemindSetterUpdateVO | null>(null)

const handleRemindUpdate = (vo: TaskRemindSetterUpdateVO) => {
    pendingRemindUpdate.value = vo
}

const handleClose = () => {
    const dayjsDate = dayjs(date.value)
    const dateChanged = !dayjsDate.isSame(dayjs(props.modelValue))

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
            <task-remind-setter
                :task="props.task"
                :date="date"
                @update="handleRemindUpdate"
            />
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
