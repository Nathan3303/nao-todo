<script setup lang="ts">
import {
    type DialogInstanceType,
    POMODORO_UPDATER_DIALOG_KEY,
    useDialogWrapper
} from '@nao-todo/shared'
import { onMounted, ref } from 'vue'
import { PomodoroForm } from '../../form'
import type { PomodoroUpdaterDialogProps } from './types'
import { usePomodoroUpdater } from './use-pomodoro-updater'

defineOptions({ name: 'PomodoroUpdater' })
const props = defineProps<PomodoroUpdaterDialogProps>()

const dialogRef = ref<DialogInstanceType>()

const { visible, close } = useDialogWrapper(dialogRef)
const { updating, isNameEmpty, form, loadPomodoro, handleConfirm, resetStates } =
    usePomodoroUpdater(props)

const open = (id: string) => {
    resetStates()
    const ok = loadPomodoro(id)
    if (ok) visible.value = true
}

const handleSubmit = async () => {
    const ok = await handleConfirm()
    if (ok) close()
}

onMounted(() => {
    // 注册对话框生命周期
    props.dialogManager.register(POMODORO_UPDATER_DIALOG_KEY, { open, close })
})
</script>

<template>
    <nue-dialog theme="pomodoro-updater" v-model="visible" ref="dialogRef">
        <template #header>
            <nue-text>编辑常用番茄专注</nue-text>
            <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
        </template>
        <template #content>
            <pomodoro-form v-model="form" :disabled="updating" :is-name-empty="isNameEmpty" />
        </template>
        <template #footer>
            <nue-button :disabled="updating" @click="close">取消</nue-button>
            <nue-button :loading="updating" theme="primary" @click="handleSubmit">保存</nue-button>
        </template>
    </nue-dialog>
</template>

<style>
.nue-dialog--pomodoro-updater {
    min-width: min(24rem, 100vw);
}
</style>