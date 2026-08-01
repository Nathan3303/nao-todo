import { unwrapError } from '@nao-todo/shared'
import { NueMessage } from 'nue-ui'
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import type { UpdateTaskViewObject } from '@nao-todo/domain-task'
import type { TaskRemindSetterUpdateVO } from '../../remind-setter'
import type { TaskCreatorDialogProps } from './types'

/**
 * 任务创建器对话框
 * @param props 任务创建器对话框属性
 */
const useTaskCreator = (props: TaskCreatorDialogProps) => {
    const { taskUseCase, subscriber, dialogManager, avaliableTags, avaliableProjects } = props
    const router = useRouter()

    // 任务视图对象
    const states = reactive<UpdateTaskViewObject>({
        name: '',
        description: '',
        state: 'todo',
        priority: 'low',
        startAt: null,
        endAt: null,
        projectId: null,
        tags: [],
        remindAt: null,
        remindRepeat: 'none',
        remindTime: null,
        remindWeekdays: []
    })

    // 创建任务状态
    const createStates = reactive({ creating: false, disabled: false })

    /**
     * 更新任务结束时间
     * @param value 任务结束时间
     */
    const handleUpdateEndAt = (value: string | null) => {
        states.endAt = value || ''
    }

    /**
     * 更新任务提醒
     * @param value 任务提醒设置值
     */
    const handleUpdateRemind = (value: TaskRemindSetterUpdateVO) => {
        states.remindAt = value.remindAt
        states.remindRepeat = value.remindRepeat
        states.remindTime = value.remindTime
        states.remindWeekdays = value.remindWeekdays
    }

    /**
     * 更新任务结束时间和提醒
     * @param value 任务视图对象
     */
    const handleUpdateEndAtAndRemind = (value: UpdateTaskViewObject) => {
        handleUpdateEndAt(value.endAt || '')
        handleUpdateRemind({
            remindAt: value.remindAt || null,
            remindRepeat: value.remindRepeat || 'none',
            remindTime: value.remindTime || null,
            remindWeekdays: value.remindWeekdays || []
        })
    }

    /**
     * 创建任务
     * @returns 是否创建成功
     */
    const handleCreateTask = async (): Promise<boolean> => {
        createStates.creating = createStates.disabled = true

        const name = states.name || ''
        const tags = states.tags || []
        const projectId = states.projectId || ''

        const [task, err] = await taskUseCase.create({
            projectId,
            name,
            description: states.description || '',
            state: states.state || '',
            priority: states.priority || '',
            startAt: states.startAt || null,
            endAt: states.endAt || null,
            tags,
            remindAt: states.remindAt || null,
            remindRepeat: states.remindRepeat || 'none',
            remindTime: states.remindTime || null,
            remindWeekdays: states.remindWeekdays || []
        })
        createStates.creating = false
        if (err !== null) {
            NueMessage.error(unwrapError(err))
            createStates.disabled = false
            return false
        }
        NueMessage.success('待办任务创建成功')
        if (task) {
            subscriber.emit('AddNewTaskId', task.id)
            router.push({ name: router.currentRoute.value.name, params: { taskId: task.id } })
        }
        return true
    }

    /**
     * 清空输入值
     */
    const clearInputsValue = () => {
        createStates.creating = false
        createStates.disabled = false
        states.projectId = ''
        states.name = ''
        states.description = ''
        states.state = 'todo'
        states.priority = 'low'
        states.startAt = ''
        states.endAt = ''
        states.tags = []
    }

    // @returns
    return {
        states,
        createStates,
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