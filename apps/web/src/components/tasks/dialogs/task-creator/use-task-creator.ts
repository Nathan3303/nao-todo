import { reactive } from 'vue'
import { NueMessage } from 'nue-ui'
import { useRouter } from 'vue-router'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { TaskCreatorProps, TaskCreatorVO } from './types'

const useTaskCreator = (props: TaskCreatorProps) => {
    // @router
    const router = useRouter()

    // @states
    const states = reactive<TaskCreatorVO>({
        projectId: '',
        name: '',
        description: '',
        state: 'todo',
        priority: 'low',
        startAt: '',
        endAt: '',
        tags: [],
        creating: false,
        disabled: false
    })

    // @method 创建待办任务
    const handleCreateTask = async () => {
        // 调用 API
        states.creating = states.disabled = true
        const [taskId, err] = await props.createTaskHandler({
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
        // 处理失败结果
        if (err !== null) {
            NueMessage.error(unwrapError(err))
            states.disabled = false
            return false
        }
        // 处理成功结果
        NueMessage.success('待办任务创建成功')
        // 跳转至新待办任务详情页
        if (props.subscriber) props.subscriber.emit('AddNewTaskId', taskId)
        router.push({ name: router.currentRoute.value.name, params: { taskId } })
        return true
    }

    // @method 清空输入值
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

    // @return
    return {
        states,
        handleCreateTask,
        clearInputsValue
    }
}

export default useTaskCreator

