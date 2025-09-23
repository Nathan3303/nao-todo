import { computed, ref, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useEventStore, useTodoStore } from '@/stores/global'
import { useUpdateQueue, type UpdateQueueItem } from './use-update-queue'
import type { Todo, UpdateTodoOptions } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/utils'

export const useTodoDetails = () => {
    const route = useRoute()
    const todoStore = useTodoStore()
    const eventStore = useEventStore()

    const { todos } = storeToRefs(todoStore)
    const { events } = storeToRefs(eventStore)
    const todo = ref<Todo>()
    const loading = ref(false)
    const error = ref('')

    // @effect 当路由 todoId 变化时重新获取数据
    watchEffect(() => {
        // 判断并获取 todoId
        if (!route.params.todoId) return
        const todoId = route.params.todoId as string
        // 重置加载状态
        loading.value = true
        // 查找待办任务
        todo.value = todos.value.find((todo) => todo.id === todoId)
        // 恢复加载状态
        loading.value = false
    })

    // @computed 检查事项进度计算属性
    const eventsProgress = computed(() => {
        const _e = events.value
        const progress = _e ? _e.filter((event) => event.isDone).length : 0
        const total = _e ? _e.length : 0
        const percentage = total ? Math.floor((progress / total) * 100) : 0
        const text = total ? `已完成 ${progress}/${total}, ${percentage}%` : '待办目前无检查事项'
        return { percentage, text }
    })

    // @states 更新待办任务属性
    // const updating = ref(false)
    const updateQueue = useUpdateQueue(async (item: UpdateQueueItem) => {
        // 重置更新状态
        // updating.value = true
        // 更新待办任务
        const err = await todoStore.updateTodo(item.todoId, item.updateOptions)
        // 恢复更新状态
        // updating.value = false
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
        }
    })

    // @method 更新待办任务截止时间
    const updateTodoEndAt = async (endAt: Todo['endAt']) => {
        if (!todo.value) return
        todo.value.endAt = endAt
        updateQueue.insertItem({ todoId: todo.value.id, updateOptions: { endAt } })
    }

    // @method 更新待办任务 (名称、描述、收藏等直接更改原值的更新)
    const updateTodo = async (key: keyof UpdateTodoOptions) => {
        if (!todo.value) return
        updateQueue.insertItem({ todoId: todo.value.id, updateOptions: { [key]: todo.value[key] } })
    }

    // @method 更新待办任务优先级
    const updateTodoPriority = (value: Todo['priority']) => {
        if (!todo.value) return
        todo.value.priority = value
        updateQueue.insertItem({ todoId: todo.value.id, updateOptions: { priority: value } })
    }

    // @methods 更新待办任务状态
    const updateTodoState = (value: Todo['state']) => {
        if (!todo.value) return
        todo.value.state = value
        updateQueue.insertItem({ todoId: todo.value.id, updateOptions: { state: value } })
    }
    const handleCheckTodo = async () => {
        if (!todo.value) return
        const newState = (todo.value.state === 'done' ? 'todo' : 'done') as Todo['state']
        updateTodoState(newState)
    }

    // @method 更新待办任务所属清单
    const updateTodoProject = async (projectId: string) => {
        if (!todo.value) return
        todo.value.projectId = projectId
        updateQueue.insertItem({ todoId: todo.value.id, updateOptions: { projectId } })
    }

    // @method 更新待办任务所属标签
    const updateTodoTags = async (tags: Todo['tags']) => {
        if (!todo.value) return
        todo.value.tags = tags
        updateQueue.insertItem({ todoId: todo.value.id, updateOptions: { tags } })
    }

    //
    // const handleDeleteTodo = async () => {
    //     if (!shadowTodo.value) return
    //     await todoStore.deleteTodoWithConfirmation(shadowTodo.value.id)
    // }
    //
    // const handleRestoreTodo = async () => {
    //     if (!shadowTodo.value) return
    //     await todoStore.restoreTodoWithConfirmation(shadowTodo.value.id)
    // }
    //
    // const handleDeleteTodoPermanently = async () => {
    //     if (!shadowTodo.value) return
    //     const result = await todoStore.deleteTodoPermanentlyWithConfirmation(shadowTodo.value.id)
    //     if (result) await handleClose()
    // }
    //
    // const handleDuplicateTodo = async () => {
    //     if (!shadowTodo.value) return
    //     const result = await todoStore.duplicateTodoWithConfirmation(shadowTodo.value.id)
    //     if (!result) return
    //     await router.push({ name: route.name, params: { taskId: (result as Todo).id as string } })
    // }
    //
    // const handleGiveUpTodo = async () => {
    //     if (!shadowTodo.value) return
    //     const result = await todoStore.giveUpTodoWithConfirmation(shadowTodo.value.id)
    //     if (result) await handleClose()
    // }
    //
    // const handleCancelGiveUpTodo = async () => {
    //     if (!shadowTodo.value) return
    //     const result = await todoStore.cancelGiveUpTodoWithConfirmation(shadowTodo.value.id)
    //     if (result) await handleClose()
    // }
    //
    // const handleClose = async () => {
    //     cancelTimer(true)
    //     shadowTodo.value = void 0
    //     await router.replace({ name: route.name, params: { taskId: void 0 } })
    // }
    //
    // watch(
    //     () => route.params.todoId as string,
    //     (newTaskId) => deboucedGetTodo(newTaskId),
    //     { immediate: true }
    // )

    // 返回

    return {
        loading,
        error,
        todo,
        eventsProgress,
        updating: updateQueue.running,
        updateTodoEndAt,
        updateTodo,
        updateTodoPriority,
        updateTodoState,
        handleCheckTodo,
        updateTodoProject,
        updateTodoTags
        // handleClose,
        // handleDeleteTodo,
        // handleDeleteTodoPermanently,
        // handleRestoreTodo,
        // handleUpdateTags,
        // handleDuplicateTodo,
        // handleGiveUpTodo,
        // handleCancelGiveUpTodo
    }
}
