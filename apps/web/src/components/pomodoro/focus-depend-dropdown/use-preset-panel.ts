import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'
import { usePomodorosStore } from '@nao-todo/presentation/pomodoro'
import type { PomodoroViewObject } from '@nao-todo/domain-pomodoro'
import { unwrapError } from '@nao-todo/shared'
import { computed, inject, onMounted, ref } from 'vue'
import type { PomodoroFocusDependDropdownProps } from './types'

/**
 * 常用专注面板 composable
 * @description 加载用户创建的常用专注列表，按当前模式（type）过滤后供下拉展示。
 */
export const usePresetPanel = (props: PomodoroFocusDependDropdownProps) => {
    /**
     * 注入番茄视图上下文
     */
    const { pomodoroUseCase } = inject(POMODORO_VIEW_CONTEXT_KEY)!

    /**
     * 常用专注 store
     */
    const store = usePomodorosStore()

    /**
     * 加载中状态
     */
    const loading = ref(false)

    /**
     * 常用专注列表（按当前模式过滤，排除已归档）
     */
    const presets = computed<PomodoroViewObject[]>(() =>
        store.getAllPomodoros().filter((p) => p.type === props.type && !p.isArchived)
    )

    /**
     * 加载常用专注列表
     */
    const refresh = async () => {
        loading.value = true
        const err = await pomodoroUseCase.loadPomodoros()
        if (err !== null) {
            console.error('[PomodoroPreset] Failed to load presets:', unwrapError(err))
        }
        loading.value = false
    }

    onMounted(refresh)

    return {
        loading,
        presets,
        refresh
    }
}