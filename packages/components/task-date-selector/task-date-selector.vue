<script lang="ts" setup>
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import type { TaskDateSelectorProps, TaskDateSelectorEmits } from './types'

defineOptions({ name: 'TaskDateSelector', inheritAttrs: false })
const props = defineProps<TaskDateSelectorProps>()
const emit = defineEmits<TaskDateSelectorEmits>()

const date = ref(dayjs(props.modelValue).format('YYYY-MM-DD HH:mm'))

const isExpired = computed(() => {
    if (!props.modelValue) return false
    return dayjs(props.modelValue).isBefore(dayjs())
})

const datePickerTheme = computed(() => {
    return { small: true, expired: props.colored && isExpired.value }
})

const handleClose = () => {
    // console.log(date.value)
    const dayjsDate = dayjs(date.value)
    if (dayjsDate.isSame(dayjs(props.modelValue))) return
    const newValue = dayjsDate.format('YYYY-MM-DDTHH:mm')
    emit('update:modelValue', newValue)
    emit('change', newValue)
}
</script>

<template>
    <nue-date-picker
        :theme="datePickerTheme"
        v-model="date"
        type="datetime"
        clearable
        @close="handleClose"
    />
</template>

<style scoped>
.nue-date-picker:deep().nue-button {
    height: 28px;
    background-color: var(--nue-primary-color-0);
    border-color: var(--nue-primary-color-200);
    color: var(--nue-primary-color-900);

    &:hover {
        border-color: var(--nue-primary-color-300);
    }

    .nue-button__text {
        font-size: var(--nue-text-sm);
    }
}

.nue-date-picker--expired:deep().nue-button {
    background-color: var(--nue-error-color-10);
    border-color: var(--nue-error-color-30);
    color: var(--nue-error-color-50);

    &:hover {
        border-color: var(--nue-error-color-40);
    }
}
</style>
