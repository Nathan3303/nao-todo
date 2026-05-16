import { inject, reactive } from 'vue'
import { NueMessage } from 'nue-ui'
import { useRouter } from 'vue-router'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { IndexViewContext } from '@/views/index/index-view'
import { INDEX_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { useProjectsStore, useTagsStore } from '@/stores'
import { storeToRefs } from 'pinia'

const useTaskCreator = () => {
    const router = useRouter()
    const { taskUseCase, subscriber, dialogManager } =
        inject<IndexViewContext>(INDEX_VIEW_CONTEXT_KEY)!
    const { projects: avaliableProjects } = storeToRefs(useProjectsStore())
    const { tags: avaliableTags } = storeToRefs(useTagsStore())

    const states = reactive({
        projectId: '' as string,
        name: '',
        description: '',
        state: 'todo' as string,
        priority: 'low' as string,
        startAt: '' as string,
        endAt: '' as string,
        tags: [] as string[],
        creating: false,
        disabled: false
    })

    const handleCreateTask = async (): Promise<boolean> => {
        states.creating = states.disabled = true
        const [task, err] = await taskUseCase.createTask({
            projectId: states.projectId,
            name: states.name,
            description: states.description,
            state: states.state,
            priority: states.priority,
            startAt: states.startAt || null,
            endAt: states.endAt || null,
            tags: states.tags
        })
        states.creating = false
        if (err !== null) {
            NueMessage.error(unwrapError(err))
            states.disabled = false
            return false
        }
        NueMessage.success('待办任务创建成功')
        if (task) {
            subscriber.emit('AddNewTaskId', task.id)
            router.push({ name: router.currentRoute.value.name, params: { taskId: task.id } })
        }
        return true
    }

    const clearInputsValue = () => {
        states.projectId = ''
        states.name = ''
        states.description = ''
        states.state = 'todo'
        states.priority = 'low'
        states.startAt = ''
        states.endAt = ''
        states.tags = []
    }

    return {
        states,
        avaliableProjects,
        avaliableTags,
        dialogManager,
        handleCreateTask,
        clearInputsValue
    }
}

export default useTaskCreator

