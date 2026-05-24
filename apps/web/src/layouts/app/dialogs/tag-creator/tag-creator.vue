<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { TagColorSelector, TagForm } from '@nao-todo/components'
import useTagCreator from './use-tag-creator'
import { type DialogInstanceType, useDialogWrapper } from '@nao-todo/components'
import { TAG_CREATOR_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'
import { t } from '@nao-todo/infrastructure/locales'

defineOptions({ name: 'TagCreator' })

const dialogRef = ref<DialogInstanceType>()

const { states, dialogManager, handleConfirm, clearInputsValue } = useTagCreator()
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

const open = () => {
    clearInputsValue()
    visible.value = true
}

onMounted(() => {
    dialogManager.register(TAG_CREATOR_DIALOG_KEY, { open, close })
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
                    <nue-text color="gray" size="12px">{{ t('dialog.tagCreator.selectColor') }}</nue-text>
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
