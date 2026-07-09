import { inject, ref, watch } from 'vue'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { CreatePomodoroViewObject } from '@nao-todo/usecases/pomodoro'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'

/**
 * 常用番茄专注创建对话框
 * @returns 常用番茄专注创建对话框状态
 */
export const usePomodoroCreator = () => {
    /**
     * 注入番茄视图上下文
     */
    const { dialogManager, pomodoroUseCase } = inject(POMODORO_VIEW_CONTEXT_KEY)!

    /**
     * 创建中状态
     */
    const creating = ref(false)

    /**
     * 名称是否为空
     */
    const isNameEmpty = ref(false)

    /**
     * 表单状态（duration 以分钟为单位展示给用户）
     */
    const form = ref<{
        type: CreatePomodoroViewObject['type']
        name: string
        description: string
        duration: number
    }>({
        type: 1,
        name: '',
        description: '',
        duration: 25
    })

    /**
     * 清空输入值
     */
    const clearInputsValue = () => {
        isNameEmpty.value = false
        form.value = { type: 1, name: '', description: '', duration: 25 }
    }

    /**
     * 处理确认创建
     */
    const handleConfirm = () => {
        const f = form.value

        // 检查名称
        if (!f.name.trim()) {
            isNameEmpty.value = true
            return Promise.resolve(false)
        }

        // 检查专注时长
        if (f.duration < 5 || f.duration > 180) {
            NueMessage.warn('专注时长必须在 5-180 分钟之间')
            return Promise.resolve(false)
        }

        // 调用用例创建常用番茄专注（分钟 → 秒）
        creating.value = true
        return pomodoroUseCase
            .create({
                type: f.type,
                name: f.name.trim(),
                description: f.description.trim() || null,
                duration: f.duration * 60
            })
            .then(([, error]) => {
                if (error !== null) {
                    console.warn(unwrapError(error))
                    return false
                }
                // 处理成功结果
                clearInputsValue()
                NueMessage.success('常用番茄专注创建成功')
                return true
            })
            .finally(() => (creating.value = false))
    }

    /**
     * 监听名称变化，更新 isNameEmpty 状态
     */
    watch(
        () => form.value.name,
        (newVal) => newVal && (isNameEmpty.value = !newVal)
    )

    // 返回状态
    return {
        creating,
        isNameEmpty,
        form,
        dialogManager,
        handleConfirm,
        clearInputsValue
    }
}
