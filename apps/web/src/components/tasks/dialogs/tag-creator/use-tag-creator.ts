import { reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { TagCreatorVO, TagCreatorProps } from './types'

const useTagCreator = (props: TagCreatorProps) => {
    // @router
    const router = useRouter()

    // @states
    const states = reactive<TagCreatorVO>({
        name: '',
        description: '',
        color: '',
        isNameEmpty: false,
        creating: false
    })

    // @method 重置状态
    const clearInputsValue = () => {
        states.name = ''
        states.description = ''
        states.color = ''
        states.isNameEmpty = false
        states.creating = false
    }

    // @method 确认创建标签
    const handleConfirm = async (): Promise<boolean> => {
        // 检查参数
        if (!states.name) {
            states.isNameEmpty = true
            return false
        }
        // 调用 API 创建标签
        states.creating = true
        const [tagId, err] = await props.creatrTagHandler({
            name: states.name,
            description: states.description,
            color: states.color
        })
        states.creating = false
        // 处理失败结果
        if (err) {
            console.warn(unwrapError(err))
            return false
        }
        // 跳转至新标签详情页
        router.push({ name: 'tasks-tag-main', params: { tagId } })
        // 处理成功结果
        NueMessage.success('标签创建成功')
        return true
    }

    // @watch 监听 name 变化，更新 isNameEmpty
    watch(
        () => states.name,
        (newVal) => newVal && (states.isNameEmpty = !newVal)
    )

    // @returns
    return {
        states,
        handleConfirm,
        clearInputsValue
    }
}

export default useTagCreator
