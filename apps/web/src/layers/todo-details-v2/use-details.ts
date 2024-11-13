import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { useTodoStore, useProjectStore, useEventStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import moment from 'moment'
import { getTodo } from '@nao-todo/apis'
import type { Todo } from '@nao-todo/types'

export const useTodoDetails = () => {
    const route = useRoute()
    const router = useRouter()
    const projectStore = useProjectStore()
    const todoStore = useTodoStore()
    const eventStore = useEventStore()

    const { events } = storeToRefs(eventStore)
    const shadowTodo = ref<Todo | undefined>()
    const loadingState = ref(false)
    const isGetting = ref(false)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    let unSubscribe: Function | null = null

    // 计算检查事项进度
    const eventsProgress = computed(() => {
        const _e = events.value
        const progress = _e ? _e.filter((event) => event.isDone).length : 0
        const total = _e ? _e.length : 0
        const percentage = total ? Math.floor((progress / total) * 100) : 0
        return {
            percentage,
            text: `已完成 ${progress}/${total}, ${percentage}%`
        }
    })

    // 获取可用清单
    const activeProjects = computed(() => {
        return projectStore.findProjectsFromLocal({
            isArchived: false,
            isDeleted: false
        })
    })

    // 获取待办信息
    const _getTodo = async (todoId: Todo['id']) => {
        if (!todoId) {
            shadowTodo.value = void 0
            return
        }
        let res = todoStore.getTodoByIdFromLocal(todoId)
        if (!res) {
            isGetting.value = true
            res = (await getTodo({ id: todoId })).data as Todo
        }
        shadowTodo.value = res as Todo
        isGetting.value = false
    }

    // 更新防抖
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

    const _updateTodo = () => {
        // loadingState.value = true
        if (!shadowTodo.value) return
        const todoId = shadowTodo.value.id
        // await updateTodo(todoId, { ...shadowTodo.value })
        todoStore.doUpdateTodo(todoId, { ...shadowTodo.value })
        // loadingState.value = false
    }

    const { debouncedFn: debouncedUpdateTodo, cancelTimer } = _debounce(_updateTodo, 1024)

    // 格式化日期
    const formatDate = (datestring: string) => {
        const dateString = moment(datestring).format('YYYY-MM-DD HH:mm')
        return dateString
    }

    // 设置结束日期
    const handleChangeEndAt = (value: string | null) => {
        if (!shadowTodo.value) return
        shadowTodo.value.dueDate.endAt = value
        debouncedUpdateTodo()
    }

    // 设置优先级
    const handleChangePriority = (value: unknown) => {
        if (!shadowTodo.value) return
        shadowTodo.value.priority = value as Todo['priority']
        debouncedUpdateTodo()
    }

    // 设置状态
    const handleChangeState = (value: unknown) => {
        if (!shadowTodo.value) return
        shadowTodo.value.state = value as Todo['state']
        debouncedUpdateTodo()
    }

    // 设置所属清单
    const handleMoveToProject = async (projectId: string, projectTitle: string) => {
        if (!shadowTodo.value) return
        shadowTodo.value.projectId = projectId
        shadowTodo.value.project = { title: projectTitle }
        debouncedUpdateTodo()
    }

    // 设置完成
    const handleCheckTodo = async () => {
        if (!shadowTodo.value) return
        if (shadowTodo.value.state === 'done') {
            shadowTodo.value.state = 'todo'
        } else {
            shadowTodo.value.state = 'done'
        }
        debouncedUpdateTodo()
    }

    // 删除
    const handleDeleteTodo = async () => {
        if (!shadowTodo.value) return
        const todoId = shadowTodo.value.id
        try {
            const result = await todoStore.deleteTodoWithConfirmation(todoId)
            if (result) handleClose()
        } catch (error) {
            console.info('handleDeleteTodo error: ', error)
        }
    }

    // 恢复
    const handleRestoreTodo = async () => {
        if (!shadowTodo.value) return
        const todoId = shadowTodo.value?.id
        try {
            const result = await todoStore.restoreTodoWithConfirmation(todoId)
            if (result) handleClose()
        } catch (error) {
            console.info('handleRestoreTodo error: ', error)
        }
    }

    // 永久删除
    const handleDeleteTodoPermanently = async () => {
        if (!shadowTodo.value) return
        const todoId = shadowTodo.value.id
        try {
            const result = await todoStore.deleteTodoPermanentlyWithConfirmation(todoId)
            if (result) handleClose()
        } catch (error) {
            console.info('handleDeleteTodoPermanently error: ', error)
        }
    }

    // 更新标签
    const handleUpdateTags = async (tags: Todo['tags']) => {
        if (!shadowTodo.value) return
        shadowTodo.value.tags = tags
        console.log(tags)
        debouncedUpdateTodo()
    }

    // 关闭详情
    const handleClose = () => {
        cancelTimer(true)
        shadowTodo.value = void 0
        const prevRoute = route.matched[route.matched.length - 1]
        if (prevRoute) {
            router.push(prevRoute)
        }
    }

    // 获取详情
    watch(
        () => route.params.taskId,
        (newValue) => {
            cancelTimer(true)
            setTimeout(async () => await _getTodo(newValue as string))
        },
        { immediate: true }
    )

    onMounted(() => {
        unSubscribe = todoStore.$subscribe((mutation) => {
            if (mutation.type !== 'direct') return
            const newValue = mutation.events.newValue
            if (!newValue) return
            if (Array.isArray(newValue)) return
            if (newValue.id && newValue.id === shadowTodo.value?.id) {
                shadowTodo.value = newValue
            }
        })
    })

    onBeforeUnmount(() => {
        if (unSubscribe) unSubscribe()
    })

    return {
        projects: activeProjects,
        shadowTodo,
        loadingState,
        isGetting,
        eventsProgress,
        formatDate,
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
        handleUpdateTags
    }
}
