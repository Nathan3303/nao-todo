<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import useProjectCreator from './use-project-creator'
import { type DialogInstanceType, useDialogWrapper, ProjectForm } from '@nao-todo/components'
import { PROJECT_CREATOR_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'

defineOptions({ name: 'ProjectCreator' })

const dialogRef = ref<DialogInstanceType>()

const { visible, close } = useDialogWrapper(dialogRef)
const { creating, isNameEmpty, viewObject, dialogManager, handleConfirm, clearInputsValue } =
    useProjectCreator()

const handleSubmit = async () => {
    const ok = await handleConfirm()
    if (ok) close()
}

onMounted(() => {
    // 注册对话框生命周期
    dialogManager.register(PROJECT_CREATOR_DIALOG_KEY, {
        open: () => {
            clearInputsValue()
            visible.value = true
        },
        close
    })
})
</script>

<template>
    <nue-dialog theme="project-creator" v-model="visible" ref="dialogRef">
        <template #header>
            <nue-text>创建任务清单</nue-text>
            <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
        </template>
        <template #content>
            <project-form v-model="viewObject" :disabled="creating" :is-name-empty="isNameEmpty" />
        </template>
        <template #footer>
            <nue-button @click="close">取消</nue-button>
            <nue-button :loading="creating" theme="primary" @click="handleSubmit">
                创建
            </nue-button>
        </template>
    </nue-dialog>
</template>

<style>
.nue-dialog--project-creator {
    min-width: min(20rem, 100vw);
}
</style>

