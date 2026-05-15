<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import useTagUpdater from './use-tag-updater'
import {
    type DialogInstanceType,
    useDialogWrapper,
    TagForm,
    TagColorSelector
} from '@nao-todo/components'
import { TAG_UPDATER_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'

defineOptions({ name: 'TagUpdater' })

const dialogRef = ref<DialogInstanceType>()

const { states, formData, dialogManager, getTag, updateTag } = useTagUpdater()
const { visible, close } = useDialogWrapper(dialogRef)

const open = (tagId: string) => {
    const ok = getTag(tagId)
    if (ok) visible.value = true
}

const handleConfirm = async () => {
    const ok = await updateTag()
    if (ok) {
        close()
        setTimeout(() => (states.value.disabled = false), 240)
    }
}

onMounted(() => {
    dialogManager.register(TAG_UPDATER_DIALOG_KEY, { open, close })
})
</script>

<template>
    <nue-dialog v-model="visible" ref="dialogRef">
        <template #header>
            <nue-text>修改标签</nue-text>
            <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
        </template>
        <template #content>
            <nue-div vertical>
                <tag-form v-model="formData" :disabled="states.value.updating" />
                <nue-div align="stretch" gap="8px" vertical>
                    <nue-text color="gray" size="12px">选择标签颜色：</nue-text>
                    <tag-color-selector v-model="states.value.color" />
                </nue-div>
            </nue-div>
        </template>
        <template #footer>
            <nue-button :disabled="states.value.updating" @click="close">取消</nue-button>
            <nue-button
                :disabled="states.value.disabled"
                :loading="states.value.updating"
                theme="primary"
                @click="handleConfirm"
            >
                修改
            </nue-button>
        </template>
    </nue-dialog>
</template>
