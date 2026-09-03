import { unwrapError } from '@nao-todo/shared'
import { NueMessage } from 'nue-ui'
import { ref, watch } from 'vue'
import { usePomodorosStore } from '../../../stores'
import type { PomodoroUpdaterDialogFormState, PomodoroUpdaterDialogProps } from './types'

/**
 * 常用番茄专注编辑对话框
 * @returns 常用番茄专注编辑对话框状态
 */
export const usePomodoroUpdater = (props: PomodoroUpdaterDialogProps) => {
    /**
     * 常用专注 store
     */
    const store = usePomodorosStore()

    /**
     * 更新中状态
     */
    const updating = ref(false)

    /**
     * 名称是否为空
     */
    const isNameEmpty = ref(false)

    /**
     * 当前编辑的常用专注 ID
     */
    const editingId = ref<string | null>(null)

    /**
     * 表单状态（duration 以分钟为单位展示给用户）
     */
    const form = ref<PomodoroUpdaterDialogFormState>({
        type: 1,
        name: '',
        description: '',
        duration: 25
    })

    /**
     * 重置状态
     */
    const resetStates = () => {
        updating.value = false
        isNameEmpty.value = false
        editingId.value = null
        form.value = { type: 1, name: '', description: '', duration: 25 }
    }

    /**
     * 载入待编辑的常用专注（秒 → 分钟）
     * @param id 常用专注 ID
     */
    const loadPomodoro = (id: string) => {
        const pomodoro = store.getPomodoro(id)
        if (!pomodoro) {
            NueMessage.error('未找到常用专注')
            return false
        }
        editingId.value = id
        form.value = {
            type: pomodoro.type,
            name: pomodoro.name,
            description: pomodoro.description ?? '',
            duration: Math.round(pomodoro.duration / 60)
        }
        return true
    }

    /**
     * 处理确认更新
     */
    const handleConfirm = async () => {
        if (!editingId.value) {
            NueMessage.error('常用专注 ID 不能为空')
            return false
        }
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
        // 调用用例更新常用番茄专注（分钟 → 秒）
        updating.value = true
        const error = await props.pomodoroUseCase.update(editingId.value, {
            type: f.type,
            name: f.name.trim(),
            description: f.description.trim() || null,
            duration: f.duration * 60
        })
        updating.value = false
        if (error !== null) {
            NueMessage.error('常用番茄专注修改失败：' + unwrapError(error))
            return false
        }
        // 处理成功结果
        NueMessage.success('常用番茄专注修改成功')
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
        updating,
        isNameEmpty,
        editingId,
        form,
        loadPomodoro,
        handleConfirm,
        resetStates
    }
}