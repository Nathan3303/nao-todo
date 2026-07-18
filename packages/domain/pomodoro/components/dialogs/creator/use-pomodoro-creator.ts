import { unwrapError } from '@nao-todo/shared'
import { NueMessage } from 'nue-ui'
import { ref, watch } from 'vue'
import type { PomodoroCreatorDialogFormStates, PomodoroCreatorDialogProps } from './types'

/**
 * 常用番茄专注创建对话框
 * @returns 常用番茄专注创建对话框状态
 */
export const usePomodoroCreator = (props: PomodoroCreatorDialogProps) => {
    // @states
    const creating = ref(false) // 创建中状态
    const isNameEmpty = ref(false) // 名称是否为空

    // 表单状态（duration 以分钟为单位展示给用户）
    const form = ref<PomodoroCreatorDialogFormStates>({
        type: 1,
        name: '',
        description: '',
        duration: 25
    })

    /**
     * 清空输入值
     */
    const clearInputsValue = () => {
        creating.value = false
        isNameEmpty.value = false
        form.value = { type: 1, name: '', description: '', duration: 25 }
    }

    /**
     * 处理确认创建
     */
    const handleConfirm = async () => {
        const f = form.value
        // 检查名称
        if (!f.name.trim()) {
            isNameEmpty.value = true
            return false
        }
        // 检查专注时长
        if (f.duration < 5 || f.duration > 180) {
            NueMessage.warn('专注时长必须在 5-180 分钟之间')
            return false
        }
        // 调用用例创建常用番茄专注（分钟 → 秒）
        creating.value = true
        const [, error] = await props.pomodoroUseCase.create({
            type: f.type,
            name: f.name.trim(),
            description: f.description.trim() || null,
            duration: f.duration * 60
        })
        if (error !== null) {
            console.warn(unwrapError(error))
            return false
        }
        // 处理成功结果
        NueMessage.success('常用番茄专注创建成功')
        return true
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
        handleConfirm,
        clearInputsValue
    }
}
