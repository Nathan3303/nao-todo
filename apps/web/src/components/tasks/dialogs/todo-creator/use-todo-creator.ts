import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { NueMessage } from 'nue-ui'
import { useRouter } from 'vue-router'
import { useTodoStore, useUserStoreV2 } from '@/stores/global'
import { useTasksDataStore } from '@/stores/tasks'
import { unwrapError } from '@nao-todo/utils'
import type { CreateTodoOptions } from '@nao-todo/types'

export const defaultCreateTodoOptions: CreateTodoOptions = {
    name: '',
    description: '',
    state: 'todo',
    priority: 'low',
    tags: [],
    projectId: '',
    startAt: null,
    endAt: null
}

const useTodoCreator = () => {
    // @states Stores
    const router = useRouter()
    const todoStore = useTodoStore()
    const userStore = useUserStoreV2()
    const tasksDataStore = useTasksDataStore()
    const { projectSmartListData: projects, tagSmartListData: tags } = storeToRefs(tasksDataStore)
    const { user } = storeToRefs(userStore)

    // @state 新待办任务
    const newTodo = ref<CreateTodoOptions>({ ...defaultCreateTodoOptions })

    // @states 创建中和禁用状态
    const creating = ref(false)
    const disabled = ref(false)

    // @method 创建待办任务
    const handleCreateTodo = async () => {
        // 参数转换
        if (newTodo.value.projectId === '' && user.value) {
            newTodo.value.projectId = user.value.id
        }
        // 调用 API
        creating.value = disabled.value = true
        const [todoId, err] = await todoStore.createTodo(newTodo.value)
        creating.value = false
        // 处理失败结果
        if (err) {
            NueMessage.error(unwrapError(err))
            disabled.value = false
            return false
        }
        // 处理成功结果
        NueMessage.success('待办任务创建成功')
        // 跳转至新待办任务详情页
        router.push({ name: router.currentRoute.value.name, params: { todoId } })
        return true
    }

    // @method 清空输入值
    const clearInputsValue = () => {
        newTodo.value = { ...defaultCreateTodoOptions }
    }

    // @return
    return {
        user,
        projects,
        tags,
        newTodo,
        creating,
        disabled,
        handleCreateTodo,
        clearInputsValue
    }
}

export default useTodoCreator

