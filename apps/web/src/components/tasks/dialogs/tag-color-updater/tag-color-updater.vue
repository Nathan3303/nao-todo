<template>
    <nue-dialog v-model="visible" ref="dialogRef">
        <template #header="{ close }">
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
                @click="updateTagColor"
            >
                修改
            </nue-button>
        </template>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import useTagColorUpdater, {
    type TagColorUpdaterEmits,
    type TagColorUpdaterProps
} from './use-tag-color-updater'
import { TagColorSelector } from '@nao-todo/components'
import { type DialogInstanceType, useDialogWrapper } from '@/components/ui/dialog-wrapper'

defineOptions({ name: 'TagColorUpdater' })
const emit = defineEmits<TagColorUpdaterEmits>()

const dialogRef = ref<DialogInstanceType>()

const { visible, payload, open, close } = useDialogWrapper(dialogRef)
const { color, updating, disabled, getTagColor, updateTagColor } = useTagColorUpdater(
    payload.value as TagColorUpdaterProps,
    emit
)

getTagColor()

defineExpose({ open, close })
</script>

<style scoped></style>
