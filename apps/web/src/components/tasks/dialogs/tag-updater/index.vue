<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import useTagUpdater from './use-tag-updater'
import {
    type DialogInstanceType,
    useDialogWrapper,
    TagForm,
    TagColorSelector
} from '@nao-todo/components'
import type { TagUpdaterEmits, TagUpdaterProps } from './types'

defineOptions({ name: 'TagUpdater' })
const props = defineProps<TagUpdaterProps>()
const emit = defineEmits<TagUpdaterEmits>()

const dialogRef = ref<DialogInstanceType>()

const { states, formData, getTag, updateTag } = useTagUpdater(props)
const { visible, close } = useDialogWrapper(dialogRef)

const open = (tagId: string) => {
    const ok = getTag(tagId)
    if (ok) visible.value = true
}

const handleConfirm = async () => {
    const ok = await updateTag()
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
