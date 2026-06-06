<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { type DialogInstanceType, useDialogWrapper } from '@nao-todo/components'
import { useTimerSettingDialog } from './use-timer-setting'
import { POMODORO_TIMER_SETTING_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'

defineOptions({ name: 'PomodoroTimerSettingDialog' })

const dialogRef = ref<DialogInstanceType>()

const { visible, close } = useDialogWrapper(dialogRef)
const { form, saving, dialogManager, clearInputsValue, handleConfirm } = useTimerSettingDialog()

// 存储 dialogManager.open 传入的 onClose 回调
let onCloseCallback: (() => void) | undefined

const handleClose = () => {
    onCloseCallback?.()
    onCloseCallback = undefined
    close()
}

const handleSubmit = () => {
    const ok = handleConfirm()
    if (ok) handleClose()
}

onMounted(() => {
    // 注册对话框生命周期
    dialogManager.register(POMODORO_TIMER_SETTING_DIALOG_KEY, {
        open: (_payload, onClose) => {
            onCloseCallback = onClose
            clearInputsValue()
            visible.value = true
        },
        close: handleClose
    })
})
</script>

<template>
    <nue-dialog theme="timer-setting" v-model="visible" ref="dialogRef">
        <template #header>
            <nue-text>番茄钟设置</nue-text>
            <nue-button @click="handleClose" icon="clear" theme="icon,ghost,small" />
        </template>
        <template #content>
            <nue-div vertical gap="var(--nue-gap-df)">
                <nue-div vertical gap="var(--nue-gap-2xs)">
                    <nue-div align="center" justify="space-between">
                        <nue-text size="sm">专注时长（分钟）</nue-text>
                        <nue-input
                            v-model="form.duration"
                            type="number"
                            size="small"
                            placeholder="25"
                            :min="5"
                            :max="180"
                            width="6rem"
                        />
                    </nue-div>
                    <nue-text size="xs" color="var(--nue-primary-color-500)">每次专注的持续时间，范围 5-180 分钟</nue-text>
                </nue-div>
                <nue-div vertical gap="var(--nue-gap-2xs)">
                    <nue-div align="center" justify="space-between">
                        <nue-text size="sm">短休息时长（分钟）</nue-text>
                        <nue-input
                            v-model="form.breakDuration"
                            type="number"
                            size="small"
                            placeholder="5"
                            :min="1"
                            :max="60"
                            width="6rem"
                        />
                    </nue-div>
                    <nue-text size="xs" color="var(--nue-primary-color-500)">短休息的持续时间，范围 1-60 分钟</nue-text>
                </nue-div>
                <nue-div vertical gap="var(--nue-gap-2xs)">
                    <nue-div align="center" justify="space-between">
                        <nue-text size="sm">长休息时长（分钟）</nue-text>
                        <nue-input
                            v-model="form.longBreakDuration"
                            type="number"
                            size="small"
                            placeholder="15"
                            :min="1"
                            :max="60"
                            width="6rem"
                        />
                    </nue-div>
                    <nue-text size="xs" color="var(--nue-primary-color-500)">长休息的持续时间，范围 1-60 分钟</nue-text>
                </nue-div>
                <nue-div vertical gap="var(--nue-gap-2xs)">
                    <nue-div align="center" justify="space-between">
                        <nue-text size="sm">长休息触发轮数</nue-text>
                        <nue-input
                            v-model="form.sessionsUntilLongBreak"
                            type="number"
                            size="small"
                            placeholder="4"
                            :min="1"
                            :max="10"
                            width="6rem"
                        />
                    </nue-div>
                    <nue-text size="xs" color="var(--nue-primary-color-500)">完成指定轮数（专注 + 短休息）后触发一次长休息</nue-text>
                </nue-div>
                <nue-divider />
                <nue-div vertical gap="var(--nue-gap-2xs)">
                    <nue-div align="center" justify="space-between">
                        <nue-text size="sm">自动开始下一轮专注</nue-text>
                        <nue-switch v-model="form.autoStartNextFocusSession" size="small" />
                    </nue-div>
                    <nue-text size="xs" color="var(--nue-primary-color-500)">休息结束后自动开始下一轮专注计时</nue-text>
                </nue-div>
                <nue-div vertical gap="var(--nue-gap-2xs)">
                    <nue-div align="center" justify="space-between">
                        <nue-text size="sm">自动开始专注次数</nue-text>
                        <nue-input
                            v-model="form.autoStartNextFocusSessionCount"
                            type="number"
                            size="small"
                            placeholder="4"
                            :min="1"
                            :max="10"
                            width="6rem"
                            :disabled="!form.autoStartNextFocusSession"
                        />
                    </nue-div>
                    <nue-text size="xs" color="var(--nue-primary-color-500)">连续自动开始专注的次数，达到后停止自动开始</nue-text>
                </nue-div>
                <nue-div vertical gap="var(--nue-gap-2xs)">
                    <nue-div align="center" justify="space-between">
                        <nue-text size="sm">自动休息</nue-text>
                        <nue-switch v-model="form.autoRest" size="small" />
                    </nue-div>
                    <nue-text size="xs" color="var(--nue-primary-color-500)">专注结束后自动进入休息阶段</nue-text>
                </nue-div>
            </nue-div>
        </template>
        <template #footer>
            <nue-button @click="handleClose">取消</nue-button>
            <nue-button :loading="saving" theme="primary" @click="handleSubmit">保存</nue-button>
        </template>
    </nue-dialog>
</template>

<style>
.nue-dialog--timer-setting {
    min-width: min(26rem, 100vw);
}
</style>
