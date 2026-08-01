<script lang="ts" setup>
import { reactive, watch } from 'vue'
import type { ProjectFormEmits, ProjectFormProps } from './types'

defineOptions({ name: 'ProjectForm' })
const props = withDefaults(defineProps<ProjectFormProps>(), {
    disabled: false,
    isNameEmpty: false
})
const emit = defineEmits<ProjectFormEmits>()

const formState = reactive({
    icon: props.modelValue.icon,
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
                placeholder="请输入清单名称"
                title="清单名称"
                maxlength="36"
                counter="word-left"
            />
            <nue-text v-if="isNameEmpty" color="#f56c6c" size="12px"> * 清单名称不能为空 </nue-text>
        </nue-div>
        <nue-div align="stretch" gap="8px" vertical>
            <nue-textarea
                v-model="formState.description"
                :disabled="disabled"
                :rows="4"
                placeholder="清单描述"
                title="清单描述"
                maxlength="128"
                counter="word-left"
                :autosize="{ minRows: 1, maxRows: 4 }"
                theme="fix-padding"
            />
        </nue-div>
    </nue-div>
</template>