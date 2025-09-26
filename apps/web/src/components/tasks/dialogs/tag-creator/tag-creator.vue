<template>
    <nue-dialog v-model="visible" ref="dialogRef">
        <template #header>
            <nue-text>创建标签</nue-text>
            <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
        </template>
        <template #content>
            <nue-div vertical gap=".5rem">
                <nue-div align="stretch" gap="4px" vertical>
                    <nue-input
                        ref="tagNameInputRef"
                        v-model="newTag.name"
                        :disabled="creating"
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
                        v-model="newTag.description"
                        :disabled="creating"
                        :rows="4"
                        placeholder="标签描述"
                        title="Project description"
                        maxlength="128"
                        counter="word-left"
                        :autosize="{ minRows: 1, maxRows: 3 }"
                        theme="fix-padding"
                    />
                </nue-div>
                <nue-div align="stretch" gap="8px" vertical>
                    <nue-text color="gray" size="12px">选择标签颜色：</nue-text>
                    <tag-color-selector v-model="newTag.color" />
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

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { type NueDialog, NueDiv, NueInput, NueTextarea } from 'nue-ui'
import { TagColorSelector } from '@nao-todo/components'
import useTagCreator, { type TagCreatorEmits } from './use-tag-creator'
import { type DialogInstanceType, useDialogWrapper } from '@/components/ui/dialog-wrapper'

defineOptions({ name: 'TagCreator' })

const emit = defineEmits<TagCreatorEmits>()

const tagNameInputRef = ref<InstanceType<typeof NueInput>>()
const dialogRef = ref<DialogInstanceType>()

const { creating, isNameEmpty, newTag, handleConfirm } = useTagCreator(emit)
const { visible, open, close } = useDialogWrapper(dialogRef)

onMounted(() => {
    tagNameInputRef.value?.innerInputRef?.focus()
})

const handleSubmit = async () => {
    const ok = await handleConfirm()
    if (ok) close()
}

defineExpose({ open, close })
</script>
