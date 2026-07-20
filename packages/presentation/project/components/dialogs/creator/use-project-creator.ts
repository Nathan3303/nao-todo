import { ref, watch } from 'vue'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/shared'
import type { CreateProjectViewObject } from '@nao-todo/application/project/viewobjects'
import { ProjectCreatorDialogProps } from './types'

/**
 * 项目创建对话框
 * @param props 项目创建对话框参数
 * @returns 项目创建对话框状态
 */
const useProjectCreator = (props: ProjectCreatorDialogProps) => {
    /**
     * 项目创建对话框状态
     */
    const creating = ref(false)

    /**
     * 项目创建对话框状态
     */
    const isNameEmpty = ref(false)

    /**
     * 项目创建对话框状态
     */
    const viewObject = ref<CreateProjectViewObject>({ icon: 'more2', name: '', description: '' })

    /**
     * 清空输入值
     */
    const clearInputsValue = () => {
        isNameEmpty.value = false
        viewObject.value = { icon: 'more2', name: '', description: '' }
    }

    /**
     * 处理确认创建
     */
    const handleConfirm = () => {
        // 检查参数
        if (!viewObject.value.name) {
            isNameEmpty.value = true
            return false
        }
        // 调用 API 创建清单
        creating.value = true
        return props.projectUseCase
            .create(viewObject.value)
            .then(([, error]) => {
                if (error !== null) {
                    console.warn(unwrapError(error))
                    return false
                }
                // 处理成功结果
                clearInputsValue()
                NueMessage.success('清单创建成功')
                return true
            })
            .finally(() => (creating.value = false))
    }

    /**
     * 监听清单名称变化
     * @use 监听清单名称变化，更新 isNameEmpty 状态
     */
    watch(
        () => viewObject.value.name,
        (newVal) => newVal && (isNameEmpty.value = !newVal)
    )

    // 返回状态
    return {
        creating,
        isNameEmpty,
        viewObject,
        handleConfirm,
        clearInputsValue
    }
}

export default useProjectCreator
