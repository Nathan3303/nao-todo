import { inject, reactive, ref, watch } from 'vue'
import type { TaskCreatorInputValue } from '@nao-todo/components'
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

    // ★ 新模式：智能输入
    const TASK_CREATOR_SMART_MODE_KEY = 'TASK_CREATOR_SMART_MODE'

    const taskInputValue = ref<TaskCreatorInputValue>({
        text: '',
        tags: [],
        projectId: null,
        priority: null,
        state: null
    })

    const useSmartCreator = ref(false)

    watch(useSmartCreator, (val) => {
        localStorage.setItem(TASK_CREATOR_SMART_MODE_KEY, String(val))
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

        let name: string
        let tags: string[]
        let projectId: string

        if (useSmartCreator.value) {
            name = taskInputValue.value.text
            tags = taskInputValue.value.tags
            projectId = taskInputValue.value.projectId || states.projectId || ''
            // 智能模式中 priority/state 由 chip 指定，否则 fallback 到表单值
            states.priority = taskInputValue.value.priority || states.priority || 'low'
            states.state = taskInputValue.value.state || states.state || 'todo'
        } else {
            name = states.name || ''
            tags = states.tags || []
            projectId = states.projectId || ''
        }

        const [task, err] = await taskUseCase.createTask({
            projectId,
            name,
            description: states.description || '',
            state: states.state || '',
            priority: states.priority || '',
            startAt: states.startAt || null,
            endAt: states.endAt || null,
            tags,
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
        taskInputValue.value = { text: '', tags: [], projectId: null, priority: null, state: null }
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
        handleUpdateEndAtAndRemind,
        useSmartCreator,
        taskInputValue
    }
}

export default useTaskCreator

