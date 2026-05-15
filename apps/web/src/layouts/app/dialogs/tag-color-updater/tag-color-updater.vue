<script setup lang="ts">
import { onMounted, ref } from 'vue'
import useTagColorUpdater from './use-tag-color-updater'
import { TagColorSelector } from '@nao-todo/components'
import { type DialogInstanceType, useDialogWrapper } from '@nao-todo/components'
import { TAG_COLOR_UPDATER_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'

defineOptions({ name: 'TagColorUpdater' })

const dialogRef = ref<DialogInstanceType>()

const { states, dialogManager, getTagColor, updateTagColor } = useTagColorUpdater()
const { visible, close } = useDialogWrapper(dialogRef)

const open = (tagId: string) => {
    getTagColor(tagId)
    visible.value = true
}

const handleConfirm = async () => {
    const ok = await updateTagColor()
    if (ok) {
        close()
        setTimeout(() => (states.disabled = false), 240)
    }
}

onMounted(() => {
    dialogManager.register(TAG_COLOR_UPDATER_DIALOG_KEY, { open, close })
})
</script>

<template>
    <nue-dialog v-model="visible" ref="dialogRef" theme="color-selector">
        <template #header>
            <nue-text>标签颜色修改</nue-text>
            <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
        </template>
        <template #content>
            <tag-color-selector v-model="states.color" />
        </template>
        <template #footer>
            <nue-button :disabled="states.updating" @click="close">取消</nue-button>
            <nue-button
                :disabled="states.disabled"
                :loading="states.updating"
                theme="primary"
                @click="handleConfirm"
            >
                修改
            </nue-button>
        </template>
    </nue-dialog>
</template>
