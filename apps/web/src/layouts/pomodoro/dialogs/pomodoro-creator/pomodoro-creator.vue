<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { type DialogInstanceType, useDialogWrapper } from '@nao-todo/components'
import { usePomodoroCreator } from './use-pomodoro-creator'
import { PomodoroForm } from '../pomodoro-form'
import { POMODORO_CREATOR_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'

defineOptions({ name: 'PomodoroCreator' })

const dialogRef = ref<DialogInstanceType>()

const { visible, close } = useDialogWrapper(dialogRef)
const { creating, isNameEmpty, form, dialogManager, handleConfirm, clearInputsValue } =
    usePomodoroCreator()

const handleSubmit = async () => {
    const ok = await handleConfirm()
    if (ok) close()
}

onMounted(() => {
    // 注册对话框生命周期
    dialogManager.register(POMODORO_CREATOR_DIALOG_KEY, {
        open: () => {
            clearInputsValue()
            visible.value = true
        },
        close
    })
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
