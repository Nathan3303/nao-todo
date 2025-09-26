import { ref, watch } from 'vue'
import { useTasksDataStore } from '@/stores/tasks'
import type { CreateProjectOptions } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/utils'
import { NueMessage } from 'nue-ui'

const DefaultCreateOptions: CreateProjectOptions = { name: '', description: '' }

const useProjectCreator = () => {
    const tasksDataStore = useTasksDataStore()

    const creating = ref(false)
    const isNameEmpty = ref(false)
    const newProject = ref<CreateProjectOptions>({ ...DefaultCreateOptions })

    const clearInputsValue = () => {
        isNameEmpty.value = false
        newProject.value = { ...DefaultCreateOptions }
    }

    const handleConfirm = async () => {
        // 检查参数
        if (!newProject.value.name) {
            isNameEmpty.value = true
            return false
        }
        // 调用 API 创建清单
        creating.value = true
        const err = await tasksDataStore.createProject(
            newProject.value.name,
            newProject.value.description
        )
        creating.value = false
        // 处理失败结果
        if (err) {
            console.warn(unwrapError(err))
            return false
        }
        // 处理成功结果
        NueMessage.success('清单创建成功')
        clearInputsValue()
        return true
    }

    watch(
        () => newProject.value.name,
        (newVal) => newVal && (isNameEmpty.value = !newVal)
    )

    return {
        creating,
        isNameEmpty,
        newProject,
        handleConfirm
    }
}

export default useProjectCreator
