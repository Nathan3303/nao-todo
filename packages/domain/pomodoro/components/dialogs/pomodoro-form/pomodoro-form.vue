<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { CreatePomodoroViewObject } from '@nao-todo/usecases/pomodoro'

defineOptions({ name: 'PomodoroForm' })

type PomodoroFormState = {
    type: CreatePomodoroViewObject['type']
    name: string
    description: string
    duration: number
}

const props = withDefaults(
    defineProps<{
        modelValue: PomodoroFormState
        disabled?: boolean
        isNameEmpty?: boolean
    }>(),
    {
        disabled: false,
        isNameEmpty: false
    }
)

const emit = defineEmits<{
    (e: 'update:modelValue', value: PomodoroFormState): void
}>()

const formState = reactive<PomodoroFormState>({
    type: props.modelValue.type,
    name: props.modelValue.name,
    description: props.modelValue.description,
    duration: props.modelValue.duration
})

watch(
    () => props.modelValue,
    (newVal) => {
        formState.type = newVal.type
        formState.name = newVal.name
        formState.description = newVal.description
        formState.duration = newVal.duration
    },
    { deep: true }
)

watch(formState, (newVal) => {
    emit('update:modelValue', { ...newVal })
})
</script>

<template>
    <nue-div vertical gap="var(--nue-gap-df)">
        <nue-div align="stretch" gap="4px" vertical width="100%">
            <nue-input
                v-model="formState.name"
                :disabled="disabled"
                clearable
                placeholder="请输入名称"
                title="名称"
                maxlength="36"
                counter="word-left"
            />
            <nue-text v-if="isNameEmpty" color="#f56c6c" size="12px"> * 名称不能为空 </nue-text>
        </nue-div>
        <nue-div align="stretch" gap="8px" vertical>
            <nue-textarea
                v-model="formState.description"
                :disabled="disabled"
                :rows="3"
                placeholder="描述（可选）"
                title="描述"
                maxlength="128"
                counter="word-left"
                :autosize="{ minRows: 1, maxRows: 4 }"
                theme="fix-padding"
            />
        </nue-div>
        <nue-div align="center" justify="space-between">
            <nue-div vertical gap="0">
                <nue-text size="sm">专注类型</nue-text>
                <nue-text size="xs" color="var(--nue-primary-color-500)">
                    番茄钟为倒计时，正计时为累计计时
                </nue-text>
            </nue-div>
            <nue-select v-model="formState.type" size="small" width="8rem" :disabled="disabled">
                <nue-select-option label="番茄专注" :value="1" />
                <nue-select-option label="正计时" :value="2" />
            </nue-select>
        </nue-div>
        <nue-div v-if="formState.type === 1" align="center" justify="space-between">
            <nue-div vertical gap="0">
                <nue-text size="sm">专注时长（分钟）</nue-text>
                <nue-text size="xs" color="var(--nue-primary-color-500)">
                    每次专注的持续时间，范围 5-180 分钟
                </nue-text>
            </nue-div>
            <nue-input
                v-model="formState.duration"
                type="number"
                size="small"
                placeholder="25"
                :min="5"
                :max="180"
                width="6rem"
                :disabled="disabled"
            />
        </nue-div>
    </nue-div>
</template>
