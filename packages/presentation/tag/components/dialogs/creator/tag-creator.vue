<script lang="ts" setup>
import {
    t,
    TAG_CREATOR_DIALOG_KEY,
    TagColorSelector,
    TagForm,
    useDialogWrapper,
    type DialogInstanceType
} from '@nao-todo/shared'
import { computed, onMounted, ref } from 'vue'
import type { TagViewObject } from '../../../types'
import { TagCreatorDialogProps } from './types'
import useTagCreator from './use-tag-creator'

defineOptions({ name: 'TagCreatorDialog' })
const props = defineProps<TagCreatorDialogProps>()

const dialogRef = ref<DialogInstanceType>()

const { states, handleConfirm, clearInputsValue } = useTagCreator(props)
const { visible, close } = useDialogWrapper(dialogRef)

const formData = computed({
    get: () => ({ name: states.value.name, description: states.value.description }),
    set: (val) => {
        states.value.name = val.name
        states.value.description = val.description
    }
})

const handleSubmit = async () => {
    const ok = await handleConfirm()
    if (ok) close()
}

const open = (payload: Partial<TagViewObject>) => {
    clearInputsValue()
    if (payload) {
        formData.value.name = payload.name || ''
        formData.value.description = payload.description || ''
    }
    visible.value = true
}

onMounted(() => {
    props.dialogManager.register(TAG_CREATOR_DIALOG_KEY, { open, close })
})
</script>

<template>
    <nue-dialog theme="tag-creator" v-model="visible" ref="dialogRef">
        <template #header>
            <nue-text>{{ t('dialog.tagCreator.title') }}</nue-text>
            <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
        </template>
        <template #content>
            <nue-div vertical>
                <tag-form
                    v-model="formData"
                    :disabled="states.creating"
                    :is-name-empty="states.isNameEmpty"
                />
                <nue-div align="stretch" gap="8px" vertical>
                    <nue-text color="gray" size="12px">{{
                        t('dialog.tagCreator.selectColor')
                    }}</nue-text>
                    <tag-color-selector v-model="states.color" />
                </nue-div>
            </nue-div>
        </template>
        <template #footer>
            <nue-button @click="close">{{ t('common.cancel') }}</nue-button>
            <nue-button :loading="states.creating" theme="primary" @click="handleSubmit">
                {{ t('common.create') }}
            </nue-button>
        </template>
    </nue-dialog>
</template>

<style>
.nue-dialog--tag-creator {
    min-width: min(20rem, 100vw);
}
</style>
