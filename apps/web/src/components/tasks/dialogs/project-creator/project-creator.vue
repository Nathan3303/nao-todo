<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import useProjectCreator from './use-project-creator'
import { type DialogInstanceType, useDialogWrapper } from '@/components/ui/dialog-wrapper'
import type { NueDialog, NueInput } from 'nue-ui'

defineOptions({ name: 'ProjectCreator' })
const emit = defineEmits<{ (e: 'register', open: () => void, close: () => void): void }>()

const nameInputRef = ref<InstanceType<typeof NueInput>>()
const dialogRef = ref<DialogInstanceType>()

const { creating, isNameEmpty, newProject, handleConfirm, clearInputsValue } = useProjectCreator()
const { visible, close } = useDialogWrapper(dialogRef)

const handleSubmit = async () => {
    const ok = await handleConfirm()
    if (ok) close()
}

const open = () => {
    clearInputsValue()
    visible.value = true
}

onMounted(() => emit('register', open, close))

// defineExpose({ open, close })
</script>

<template>
    <nue-dialog v-model="visible" ref="dialogRef">
        <template #header>
            <nue-text>创建清单</nue-text>
            <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
        </template>
        <template #content>
            <nue-div vertical gap="0.5rem">
                <nue-div align="stretch" gap="4px" vertical width="100%">
                    <nue-input
                        ref="nameInputRef"
                        v-model="newProject.name"
                        :disabled="creating"
                        clearable
                        placeholder="请输入清单名称"
                        title="清单名称"
                        maxlength="36"
                        counter="word-left"
                    />
                    <nue-text v-if="isNameEmpty" color="#f56c6c" size="12px">
                        * 清单名称不能为空
                    </nue-text>
                </nue-div>
                <nue-div align="stretch" gap="8px" vertical>
                    <nue-textarea
                        v-model="newProject.description"
                        :disabled="creating"
                        :rows="4"
                        placeholder="清单描述"
                        title="Project description"
                        maxlength="128"
                        counter="word-left"
                        :autosize="{ minRows: 1, maxRows: 4 }"
                        theme="fix-padding"
                    />
                </nue-div>
            </nue-div>
        </template>
        <template #footer>
            <nue-button @click="close">取消</nue-button>
            <nue-button :loading="creating" theme="primary" @click="handleSubmit">
                创建
            </nue-button>
        </template>
    </nue-dialog>
</template>

