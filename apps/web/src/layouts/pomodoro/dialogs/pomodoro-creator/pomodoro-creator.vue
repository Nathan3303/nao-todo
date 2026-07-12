<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { type DialogInstanceType, useDialogWrapper } from '@nao-todo/components'
import { usePomodoroCreator } from './use-pomodoro-creator'
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
            <nue-div vertical gap="var(--nue-gap-df)">
                <nue-div align="stretch" gap="4px" vertical width="100%">
                    <nue-input
                        v-model="form.name"
                        :disabled="creating"
                        clearable
                        placeholder="请输入名称"
                        title="名称"
                        maxlength="36"
                        counter="word-left"
                    />
                    <nue-text v-if="isNameEmpty" color="#f56c6c" size="12px">
                        * 名称不能为空
                    </nue-text>
                </nue-div>
                <nue-div align="stretch" gap="8px" vertical>
                    <nue-textarea
                        v-model="form.description"
                        :disabled="creating"
                        :rows="3"
                        placeholder="描述（可选）"
                        title="描述"
                        maxlength="128"
                        counter="word-left"
                        :autosize="{ minRows: 1, maxRows: 4 }"
                        theme="fix-padding"
                    />
                </nue-div>
                <nue-div align="center" justify="space-between">
                    <nue-div vertical gap="0">
                        <nue-text size="sm">专注类型</nue-text>
                        <nue-text size="xs" color="var(--nue-primary-color-500)">
                            番茄钟为倒计时，正计时为累计计时
                        </nue-text>
                    </nue-div>
                    <nue-select v-model="form.type" size="small" width="8rem" :disabled="creating">
                        <nue-select-option label="番茄专注" :value="1" />
                        <nue-select-option label="正计时" :value="2" />
                    </nue-select>
                </nue-div>
                <nue-div v-if="form.type === 1" align="center" justify="space-between">
                    <nue-div vertical gap="0">
                        <nue-text size="sm">专注时长（分钟）</nue-text>
                        <nue-text size="xs" color="var(--nue-primary-color-500)">
                            每次专注的持续时间，范围 5-180 分钟
                        </nue-text>
                    </nue-div>
                    <nue-input
                        v-model="form.duration"
                        type="number"
                        size="small"
                        placeholder="25"
                        :min="5"
                        :max="180"
                        width="6rem"
                        :disabled="creating"
                    />
                </nue-div>
            </nue-div>
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
