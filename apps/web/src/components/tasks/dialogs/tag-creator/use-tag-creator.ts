import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NueMessage } from 'nue-ui'
import { useTasksDataStore } from '@/stores/tasks'
import { unwrapError } from '@nao-todo/utils'
import type { CreateTagOptions } from '@nao-todo/types'

export type TagCreatorEmits = {
    (e: 'closeDialog'): void
    (e: 'register', open: () => void, close: () => void): void 
}

const DefaultCreateOptions: CreateTagOptions = {
    name: '',
    description: '',
    color: 'transparent'
}

const useTagCreator = (emit: TagCreatorEmits) => {
    const tasksDataStore = useTasksDataStore()
    const router = useRouter()

    const creating = ref(false)
    const isNameEmpty = ref(false)
    const newTag = ref<CreateTagOptions>({ ...DefaultCreateOptions })

    const clearInputsValue = () => {
        isNameEmpty.value = false
        newTag.value = { ...DefaultCreateOptions }
    }

    const handleConfirm = async () => {
        // 检查参数
        if (!newTag.value.name) {
            isNameEmpty.value = true
            return false
        }
        // 调用 API 创建标签
        creating.value = true
        const [tagId, err] = await tasksDataStore.createTag(
            newTag.value.name,
            newTag.value.color,
            newTag.value.description
        )
        creating.value = false
        // 处理失败结果
        if (err) {
            console.warn(unwrapError(err))
            return false
        }
        // 跳转至新标签详情页
        router.push({ name: 'tasks-tag-main', params: { tagId } })
        // 处理成功结果
        emit('closeDialog')
        clearInputsValue()
        NueMessage.success('标签创建成功')
        return true
    }

    watch(
        () => newTag.value.name,
        (newVal) => newVal && (isNameEmpty.value = !newVal)
    )

    return {
        creating,
        isNameEmpty,
        newTag,
        handleConfirm
    }
}

export default useTagCreator
