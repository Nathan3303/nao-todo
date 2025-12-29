<script setup lang="ts">
import { onMounted, ref } from 'vue'
import useTagColorUpdater from './use-tag-color-updater'
import { TagColorSelector } from '@nao-todo/components'
import { type DialogInstanceType, useDialogWrapper } from '@/components/ui/dialog-wrapper'
import type { TagColorUpdaterEmits, TagColorUpdaterProps } from './types'

defineOptions({ name: 'TagColorUpdater' })
const props = defineProps<TagColorUpdaterProps>()
const emit = defineEmits<TagColorUpdaterEmits>()

const dialogRef = ref<DialogInstanceType>()

const { states, getTagColor, updateTagColor } = useTagColorUpdater(props)
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

onMounted(() => emit('register', open, close))
</script>

<template>
    <nue-dialog v-model="visible" ref="dialogRef">
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
