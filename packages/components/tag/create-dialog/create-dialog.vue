<template>
    <nue-dialog v-model="visible" title="创建标签" :closable="!loading">
        <nue-div vertical>
            <nue-div vertical align="stretch" gap="4px">
                <nue-input
                    ref="tagNameInputRef"
                    v-model="newTag.name"
                    title="Tag name"
                    placeholder="标签名称 (必填)"
                    :disabled="loading"
                />
                <nue-text v-if="isTagNameEmpty" size="12px" color="#f56c6c">
                    * 标签名称不能为空
                </nue-text>
            </nue-div>
            <nue-div vertical align="stretch" gap="8px">
                <nue-text size="12px" color="gray">选择标签颜色：</nue-text>
                <tag-color-selector v-model="newTag.color" />
            </nue-div>
        </nue-div>
        <template #footer="{ cancel }">
            <nue-button :disabled="loading" @click="cancel">取消</nue-button>
            <nue-button theme="primary" :loading="loading" @click="handleCreateTag">
                创建
            </nue-button>
        </template>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { NueInput } from 'nue-ui'
import { TagColorSelector } from '@nao-todo/components'
import type { CreateOptions, CreateTagDialogProps } from './types'

defineOptions({ name: 'CreateTagDialog' })
const props = defineProps<CreateTagDialogProps>()

const tagNameInputRef = ref<InstanceType<typeof NueInput>>()
const newTag = ref<CreateOptions>({ name: '', color: '' })
const visible = ref(false)
const loading = ref(false)
const isTagNameEmpty = ref(false)

const showCreateTagDialog = async () => {
    visible.value = true
    await nextTick(() => tagNameInputRef.value?.innerInputRef?.focus())
}

const handleClearInputValues = () => {
    newTag.value = { name: '', color: '' }
}

const handleCreateTag = async () => {
    const { handler } = props
    if (!newTag.value.name) {
        isTagNameEmpty.value = true
        return
    }
    loading.value = true
    try {
        const response = await handler({ ...newTag.value })
        if (!response) return
        visible.value = false
        handleClearInputValues()
    } catch (e) {
        console.warn('[CreateProjectDialog] confirm error:', e)
    } finally {
        loading.value = false
    }
}

defineExpose({
    show: showCreateTagDialog,
    clear: handleClearInputValues
})
</script>
