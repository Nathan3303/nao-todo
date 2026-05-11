import { ref, watch } from 'vue'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { TagCreatorVO, TagCreatorProps } from './types'

const useTagCreator = (props: TagCreatorProps) => {
    // @states
    const states = ref<TagCreatorVO>({
        name: '',
        description: '',
        color: '',
        isNameEmpty: false,
        creating: false
    })

    // @method 重置状态
    const clearInputsValue = () => {
        states.value = {
            name: '',
            description: '',
            color: '',
            isNameEmpty: false,
            creating: false
        }
    }

    // @method 确认创建标签
    const handleConfirm = async (): Promise<boolean> => {
        // 检查参数
        if (!states.value.name) {
            states.value.isNameEmpty = true
            return false
        }
        // 调用 API 创建标签
        states.value.creating = true
        const [, err] = await props.creatrTagHandler({
            name: states.value.name,
            description: states.value.description,
            color: states.value.color
        })
        states.value.creating = false
        // 处理失败结果
        if (err) {
            console.warn(unwrapError(err))
            return false
        }
        // 处理成功结果
        NueMessage.success('标签创建成功')
        return true
    }

    // @watch 监听 name 变化，更新 isNameEmpty
    watch(
        () => states.value.name,
        (newVal) => newVal && (states.value.isNameEmpty = !newVal)
    )

    // @returns
    return {
        states,
        handleConfirm,
        clearInputsValue
    }
}

export default useTagCreator

