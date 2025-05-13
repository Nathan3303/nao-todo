import { computed, ref, watch } from 'vue'
import { useCommentStore, useEventStore, useTodoStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { getTodo } from '@nao-todo/apis'
import { useUpdateQueue } from './use-update-queue'
import type { Todo } from '@nao-todo/types'
import { debounce } from '@nao-todo/utils'

export const useTodoDetails = () => {
    const route = useRoute()
    const router = useRouter()
    const todoStore = useTodoStore()
    const eventStore = useEventStore()
    const commentStore = useCommentStore()
    const updateQueue = useUpdateQueue()

    const { events } = storeToRefs(eventStore)
    const shadowTodo = ref<Todo | undefined>()
    const loadingState = ref(false)
    const isGetting = ref(false)

    const eventsProgress = computed(() => {
        const _e = events.value
        const progress = _e ? _e.filter((event) => event.isDone).length : 0
        const total = _e ? _e.length : 0
        const percentage = total ? Math.floor((progress / total) * 100) : 0
        const text = total ? `已完成 ${progress}/${total}, ${percentage}%` : '待办目前无检查事项'
        return { percentage, text }
    })

    const _getTodo = async (todoId: Todo['id']) => {
        if (!todoId) {
            shadowTodo.value = void 0
            return
        }
        if (!shadowTodo.value) {
            isGetting.value = true
        }
        let res = todoStore.getTodoByIdFromLocal(todoId)
        if (!res) {
            res = (await getTodo({ id: todoId })).data as Todo
        }
        shadowTodo.value = res as Todo
        commentStore.getOptions.todoId = todoId
        eventStore.getOptions.todoId = todoId
        await Promise.allSettled([commentStore.doGetComments(), eventStore.doGetEvents()])
        isGetting.value = false
    }

    const deboucedGetTodo = debounce(_getTodo, 32)

    const _debounce = (callback: () => void | Promise<any>, delay: number) => {
        let timer: number | null = null
        const debouncedFn = () => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => {
                callback()
                timer = null
            }, delay)
        }
        const cancelTimer = (execute: boolean = false) => {
            if (!timer) return
            if (execute) callback()
            clearTimeout(timer)
            timer = null
        }
        return { debouncedFn, cancelTimer }
    }

    const { debouncedFn: debouncedUpdateTodo, cancelTimer } = _debounce(async () => {
        if (!shadowTodo.value) return
        const todoId = shadowTodo.value.id
        const newTodo = { ...shadowTodo.value }
        return await todoStore.doUpdateTodo(todoId, newTodo)
    }, 512)

    const handleChangeEndAt = (value: string | null) => {
        if (!shadowTodo.value) return
        shadowTodo.value.dueDate.endAt = value
        updateQueue.insertItem({
            todoId: shadowTodo.value.id,
            updateOptions: { dueDate: { startAt: shadowTodo.value.dueDate.startAt, endAt: value } }
        })
    }

    const handleChangePriority = (value: unknown) => {
        if (!shadowTodo.value) return
        shadowTodo.value.priority = value as Todo['priority']
        updateQueue.insertItem({
            todoId: shadowTodo.value.id,
            updateOptions: { priority: value as Todo['priority'] }
        })
    }

    const handleChangeState = (value: unknown) => {
        if (!shadowTodo.value) return
        shadowTodo.value.state = value as Todo['state']
        updateQueue.insertItem({
            todoId: shadowTodo.value.id,
            updateOptions: { state: value as Todo['state'] }
        })
    }

    const handleMoveToProject = async (projectId: string, projectTitle: string) => {
        if (!shadowTodo.value) return
        shadowTodo.value.projectId = projectId
        shadowTodo.value.project = { title: projectTitle }
        updateQueue.insertItem({ todoId: shadowTodo.value.id, updateOptions: { projectId } })
    }

    const handleCheckTodo = async () => {
        if (!shadowTodo.value) return
        const newState = (shadowTodo.value.state === 'done' ? 'todo' : 'done') as Todo['state']
        shadowTodo.value.state = newState
        updateQueue.insertItem({
            todoId: shadowTodo.value.id,
            updateOptions: { state: newState }
        })
    }

    const handleUpdateTags = async (tags: Todo['tags']) => {
        if (!shadowTodo.value) return
        shadowTodo.value.tags = tags
        updateQueue.insertItem({ todoId: shadowTodo.value.id, updateOptions: { tags } })
    }

    const handleDeleteTodo = async () => {
        if (!shadowTodo.value) return
        await todoStore.deleteTodoWithConfirmation(shadowTodo.value.id)
    }

    const handleRestoreTodo = async () => {
        if (!shadowTodo.value) return
        await todoStore.restoreTodoWithConfirmation(shadowTodo.value.id)
    }

    const handleDeleteTodoPermanently = async () => {
        if (!shadowTodo.value) return
        const result = await todoStore.deleteTodoPermanentlyWithConfirmation(shadowTodo.value.id)
        if (result) await handleClose()
    }

    const handleDuplicateTodo = async () => {
        if (!shadowTodo.value) return
        const result = await todoStore.duplicateTodoWithConfirmation(shadowTodo.value.id)
        if (!result) return
        await router.push({ name: route.name, params: { taskId: (result as Todo).id as string } })
    }

    const handleGiveUpTodo = async () => {
        if (!shadowTodo.value) return
        const result = await todoStore.giveUpTodoWithConfirmation(shadowTodo.value.id)
        if (result) await handleClose()
    }
    
    const handleCancelGiveUpTodo = async () => {
        if (!shadowTodo.value) return
        const result = await todoStore.cancelGiveUpTodoWithConfirmation(shadowTodo.value.id)
        if (result) await handleClose()
    }

    const handleClose = async () => {
        cancelTimer(true)
        shadowTodo.value = void 0
        await router.replace({ name: route.name, params: { taskId: void 0 } })
    }

    watch(
        () => route.params.taskId as string,
        (newTaskId) => deboucedGetTodo(newTaskId),
        { immediate: true }
    )

    // 返回
    return {
        shadowTodo,
        loadingState,
        isGetting,
        eventsProgress,
        updateTodo: debouncedUpdateTodo,
        handleChangeEndAt,
        handleChangePriority,
        handleChangeState,
        handleClose,
        handleMoveToProject,
        handleCheckTodo,
        handleDeleteTodo,
        handleDeleteTodoPermanently,
        handleRestoreTodo,
        handleUpdateTags,
        handleDuplicateTodo,
        handleGiveUpTodo,
        handleCancelGiveUpTodo
    }
}
