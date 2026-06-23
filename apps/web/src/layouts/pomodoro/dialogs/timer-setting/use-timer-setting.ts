import { inject, ref } from 'vue'
import { NueMessage } from 'nue-ui'
import type { PomodoroViewContext } from '@/views/index/pomodoro/pomodoro-view'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { PomodoroTimerSettingViewObject } from '@/views/index/pomodoro/types'
import usePomodoroStore from '@/stores/pomodoro-store'

/**
 * 番茄钟计时器设置对话框
 */
export const useTimerSettingDialog = () => {
    /**
     * 注入番茄视图上下文
     */
    const { dialogManager } = inject<PomodoroViewContext>(POMODORO_VIEW_CONTEXT_KEY)!

    /**
     * 番茄钟 store
     */
    const store = usePomodoroStore()

    /**
     * 保存中状态
     */
    const saving = ref(false)

    /**
     * 表单状态（分钟为单位展示给用户）
     */
    const form = ref<PomodoroTimerSettingViewObject>({
        duration: 25,
        breakDuration: 5,
        longBreakDuration: 15,
        sessionsUntilLongBreak: 4,
        autoStartNextFocusSession: false,
        autoStartNextFocusSessionCount: 4,
        autoRest: true
    })

    /**
     * 从 store 加载当前值到表单
     */
    const clearInputsValue = () => {
        form.value = {
            duration: Math.round(store.focusDuration / 60),
            breakDuration: Math.round(store.breakDuration / 60),
            longBreakDuration: Math.round(store.longBreakDuration / 60),
            sessionsUntilLongBreak: store.sessionsUntilLongBreak,
            autoStartNextFocusSession: store.autoStartNextFocusSession,
            autoStartNextFocusSessionCount: store.autoStartNextFocusSessionCount,
            autoRest: store.autoRest
        }
    }

    /**
     * 保存设置到 store
     */
    const handleConfirm = (): boolean => {
        const f = form.value

        // 基础验证
        if (f.duration < 5 || f.duration > 180) {
            NueMessage.warn('专注时间必须在 5-180 分钟之间')
            return false
        }
        if (f.breakDuration < 1 || f.breakDuration > 60) {
            NueMessage.warn('短休息时间必须在 1-60 分钟之间')
            return false
        }
        if (f.longBreakDuration < 1 || f.longBreakDuration > 60) {
            NueMessage.warn('长休息时间必须在 1-60 分钟之间')
            return false
        }
        if (f.sessionsUntilLongBreak < 1 || f.sessionsUntilLongBreak > 10) {
            NueMessage.warn('长休息触发轮数必须在 1-10 之间')
            return false
        }

        // 设置保存中状态
        saving.value = true

        try {
            // 写入 store（分钟 → 秒）
            store.setFocusDuration(f.duration * 60)
            store.setBreakDuration(f.breakDuration * 60)
            store.setLongBreakDuration(f.longBreakDuration * 60)
            store.setSessionsUntilLongBreak(f.sessionsUntilLongBreak)
            store.setAutoStartNextFocusSession(f.autoStartNextFocusSession)
            store.setAutoStartNextFocusSessionCount(f.autoStartNextFocusSessionCount)
            store.setAutoRest(f.autoRest)

            NueMessage.success('设置已保存')
            return true
        } finally {
            saving.value = false
        }
    }

    return {
        form,
        saving,
        dialogManager,
        clearInputsValue,
        handleConfirm
    }
}
