<script lang="ts" setup>
import {
    type DialogInstanceType,
    TAG_UPDATER_DIALOG_KEY,
    TagColorSelector,
    TagForm,
    useDialogWrapper
} from '@nao-todo/shared'
import { onMounted, ref } from 'vue'
import { TagUpdaterDialogProps } from './types'
import useTagUpdater from './use-tag-updater'

defineOptions({ name: 'TagUpdater' })
const props = defineProps<TagUpdaterDialogProps>()

const dialogRef = ref<DialogInstanceType>()

const { states, formData, getTag, updateTag, resetStates } = useTagUpdater(props)
const { visible, close } = useDialogWrapper(dialogRef)

const open = (tagId: string) => {
    resetStates()
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
    props.dialogManager.register(TAG_UPDATER_DIALOG_KEY, { open, close })
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
                <tag-form v-model="formData" :disabled="states.updating" />
                <nue-div align="stretch" gap="8px" vertical>
                    <nue-text color="gray" size="12px">选择标签颜色：</nue-text>
                    <tag-color-selector v-model="states.color" />
                </nue-div>
            </nue-div>
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