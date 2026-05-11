import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { ProjectCreatorProps, ProjectCreatorVO } from './types'

const useProjectCreator = (props: ProjectCreatorProps) => {
    const router = useRouter()

    const creating = ref(false)
    const isNameEmpty = ref(false)
    const viewObject = ref<ProjectCreatorVO>({ name: '', description: '' })

    const clearInputsValue = () => {
        isNameEmpty.value = false
        viewObject.value = { name: '', description: '' }
    }

    const handleConfirm = async () => {
        // 检查参数
        if (!viewObject.value.name) {
            isNameEmpty.value = true
            return false
        }
        // 调用 API 创建清单
        creating.value = true
        const [projectId, createError] = await props.creator({
            name: viewObject.value.name,
            description: viewObject.value.description
        })
        creating.value = false
        // 处理失败结果
        if (createError !== null) {
            console.warn(unwrapError(createError))
            return false
        }
        // 跳转至新清单详情页
        router.push({ name: 'tasks-project-main', params: { projectId } })
        // 处理成功结果
        clearInputsValue()
        NueMessage.success('清单创建成功')
        return true
    }

    watch(
        () => viewObject.value.name,
        (newVal) => newVal && (isNameEmpty.value = !newVal)
    )

    return {
        creating,
        isNameEmpty,
        viewObject,
        handleConfirm,
        clearInputsValue
    }
}

export default useProjectCreator
