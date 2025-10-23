<script setup lang="ts">
import { onMounted, ref } from 'vue'
import useTagColorUpdater from './use-tag-color-updater'
import { TagColorSelector } from '@nao-todo/components'
import { type DialogInstanceType, useDialogWrapper } from '@/components/ui/dialog-wrapper'
import type { DialogOpenFunction, DialogCloseFunction } from '@/stores/tasks/use-tasks-dialog-store'

defineOptions({ name: 'TagColorUpdater' })
const emit = defineEmits<{
    (e: 'register', open: DialogOpenFunction, close: DialogCloseFunction): void
}>()

const dialogRef = ref<DialogInstanceType>()

const { color, updating, disabled, getTagColor, updateTagColor } = useTagColorUpdater()
const { visible, open: openDialog, close } = useDialogWrapper(dialogRef)

const open = (tagId: string) => {
    getTagColor(tagId)
    openDialog()
}

const handleConfirm = async () => {
    const ok = await updateTagColor()
    if (ok) {
        close()
        setTimeout(() => (disabled.value = false), 240)
    }
}

onMounted(() => {
    emit('register', open, close)
})

defineExpose({ open, close })
</script>

<template>
    <nue-dialog v-model="visible" ref="dialogRef">
        <template #header>
            <nue-text>标签颜色修改</nue-text>
            <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
        </template>
        <template #content>
            <tag-color-selector v-model="color" />
        </template>
        <template #footer>
            <nue-button :disabled="updating" @click="close">取消</nue-button>
            <nue-button
                :disabled="disabled"
                :loading="updating"
                theme="primary"
                @click="handleConfirm"
            >
                修改
            </nue-button>
        </template>
    </nue-dialog>
</template>

