<template>
    <nue-dialog v-model="visible" title="创建标签" @confirm="handleCreateTag">
        <nue-div vertical>
            <nue-div vertical align="stretch">
                <nue-input
                    ref="tagNameInputRef"
                    v-model="newTag.name"
                    title="Tag name"
                    placeholder="标签名称 (必填)"
                ></nue-input>
            </nue-div>
            <nue-div align="center">
                <nue-text size="12px" color="gray">选择标签颜色：</nue-text>
                <tag-color-dot
                    v-for="color in tagColors"
                    :key="color"
                    :color="color"
                    :class="{ selected: newTag.color === color }"
                    @click="handleSelectColor(color)"
                ></tag-color-dot>
            </nue-div>
        </nue-div>
        <template #footer="{ cancel, confirm }">
            <nue-button @click.stop="cancel">取消</nue-button>
            <nue-button theme="primary" @click.stop="confirm">创建</nue-button>
        </template>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { NueMessage, NueInput } from 'nue-ui'
import { TagColorDot } from '@/components'
import type { CreateTagDialogEmits, CreateTagPayload } from './types'

defineOptions({ name: 'CreateTagDialog' })
const emit = defineEmits<CreateTagDialogEmits>()

const visible = ref(false)
const tagColors = ['#ff6161', '#ff9800', '#ffd324', '#4caf50', '#2196f3', '#9c27b0', '#673ab7']
const newTag = ref<CreateTagPayload>({ name: '', color: tagColors[0] })
const tagNameInputRef = ref<InstanceType<typeof NueInput>>()

const showCreateTagDialog = () => {
    visible.value = true
    nextTick(() => {
        tagNameInputRef.value?.innerInputRef?.focus()
    })
}

const handleCreateTag = () => {
    if (!newTag.value.name) {
        NueMessage.error('Tag name is required')
        return
    }
    emit('create', newTag.value)
}

const handleSelectColor = (color: string) => {
    newTag.value.color = color
}

const handleClearInputValues = () => {
    newTag.value = { name: '', color: tagColors[0] }
}

defineExpose({
    show: showCreateTagDialog,
    clear: handleClearInputValues
})
</script>

<style scoped>
@import url('./create-dialog.css');
</style>
