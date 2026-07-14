<script lang="ts" setup>
import { reactive, watch } from 'vue'
import type { TagFormEmits, TagFormProps } from './types'

defineOptions({ name: 'TagForm' })
const props = withDefaults(defineProps<TagFormProps>(), {
    disabled: false,
    isNameEmpty: false
})
const emit = defineEmits<TagFormEmits>()

const formState = reactive({
    name: props.modelValue.name,
    description: props.modelValue.description
})

watch(
    () => props.modelValue,
    (newVal) => {
        formState.name = newVal.name
        formState.description = newVal.description
    },
    { deep: true }
)

watch(formState, (newVal) => {
    emit('update:modelValue', { ...newVal })
})
</script>

<template>
    <nue-div vertical gap="0.5rem">
        <nue-div align="stretch" gap="4px" vertical width="100%">
            <nue-input
                v-model="formState.name"
                :disabled="disabled"
                clearable
                placeholder="请输入标签名称"
                title="标签名称"
                maxlength="36"
                counter="word-left"
            />
            <nue-text v-if="isNameEmpty" color="#f56c6c" size="12px">
                * 标签名称不能为空
            </nue-text>
        </nue-div>
        <nue-div align="stretch" gap="8px" vertical>
            <nue-textarea
                v-model="formState.description"
                :disabled="disabled"
                :rows="4"
                placeholder="标签描述"
                title="标签描述"
                maxlength="128"
                counter="word-left"
                :autosize="{ minRows: 1, maxRows: 3 }"
                theme="fix-padding"
            />
        </nue-div>
    </nue-div>
</template>
