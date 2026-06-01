import { inject, reactive } from 'vue'
import { NueMessage } from 'nue-ui'
import { useRouter } from 'vue-router'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { IndexViewContext } from '@/views/index/index-view'
import { INDEX_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { useProjectsStore, useTagsStore } from '@/stores'
import { storeToRefs } from 'pinia'
import type { UpdateTaskViewObject } from '@nao-todo/types'
import { TaskRemindSetterUpdateVO } from '@nao-todo/components'

const useTaskCreator = () => {
    const router = useRouter()
    const { taskUseCase, subscriber, dialogManager } =
        inject<IndexViewContext>(INDEX_VIEW_CONTEXT_KEY)!

    const projectsStore = useProjectsStore()
    const tagsStore = useTagsStore()

    const { avaliableProjects } = storeToRefs(projectsStore)
    const { tags: avaliableTags } = storeToRefs(tagsStore)

    const states = reactive<UpdateTaskViewObject & { creating: boolean; disabled: boolean }>({
        projectId: '',
        name: '',
        description: '',
        state: 'todo',
        priority: 'low',
        startAt: '',
        endAt: null,
        tags: [],
        remindAt: null,
        remindRepeat: 'none',
        remindTime: null,
        remindWeekdays: [],
        creating: false,
        disabled: false
    })

    const handleUpdateEndAt = (value: string | null) => {
        states.endAt = value || ''
    }

    const handleUpdateRemind = (value: TaskRemindSetterUpdateVO) => {
        states.remindAt = value.remindAt
        states.remindRepeat = value.remindRepeat
        states.remindTime = value.remindTime
        states.remindWeekdays = value.remindWeekdays
    }

    const handleUpdateEndAtAndRemind = (value: UpdateTaskViewObject) => {
        handleUpdateEndAt(value.endAt || '')
        handleUpdateRemind({
            remindAt: value.remindAt || null,
            remindRepeat: value.remindRepeat || 'none',
            remindTime: value.remindTime || null,
            remindWeekdays: value.remindWeekdays || []
        })
    }

    const handleCreateTask = async (): Promise<boolean> => {
        states.creating = states.disabled = true
        const [task, err] = await taskUseCase.createTask({
            projectId: states.projectId || '',
            name: states.name || '',
            description: states.description || '',
            state: states.state || '',
            priority: states.priority || '',
            startAt: states.startAt || null,
            endAt: states.endAt || null,
            tags: states.tags,
            remindAt: states.remindAt || null,
            remindRepeat: states.remindRepeat,
            remindTime: states.remindTime || null,
            remindWeekdays: states.remindWeekdays
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
        clearInputsValue,
        handleUpdateEndAt,
        handleUpdateRemind,
        handleUpdateEndAtAndRemind
    }
}

export default useTaskCreator

