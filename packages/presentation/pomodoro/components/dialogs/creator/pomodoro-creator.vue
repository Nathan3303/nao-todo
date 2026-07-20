<script setup lang="ts">
import {
    type DialogInstanceType,
    POMODORO_CREATOR_DIALOG_KEY,
    useDialogWrapper
} from '@nao-todo/shared'
import { onMounted, ref } from 'vue'
import { PomodoroForm } from '../../form'
import type { PomodoroCreatorDialogProps } from './types'
import { usePomodoroCreator } from './use-pomodoro-creator'

defineOptions({ name: 'PomodoroCreator' })
const props = defineProps<PomodoroCreatorDialogProps>()

const dialogRef = ref<DialogInstanceType>()

const { visible, close } = useDialogWrapper(dialogRef)
const { creating, isNameEmpty, form, handleConfirm, clearInputsValue } = usePomodoroCreator(props)

const open = () => {
    clearInputsValue()
    visible.value = true
}

const handleSubmit = async () => {
    const ok = await handleConfirm()
    if (ok) close()
}

onMounted(() => {
    // 注册对话框生命周期
    props.dialogManager.register(POMODORO_CREATOR_DIALOG_KEY, { open, close })
})
</script>

<template>
    <nue-dialog theme="pomodoro-creator" v-model="visible" ref="dialogRef">
        <template #header>
            <nue-text>新建常用番茄专注</nue-text>
            <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
        </template>
        <template #content>
            <pomodoro-form v-model="form" :disabled="creating" :is-name-empty="isNameEmpty" />
        </template>
        <template #footer>
            <nue-button @click="close">取消</nue-button>
            <nue-button :loading="creating" theme="primary" @click="handleSubmit">创建</nue-button>
        </template>
    </nue-dialog>
</template>

<style>
.nue-dialog--pomodoro-creator {
    min-width: min(24rem, 100vw);
}
</style>
