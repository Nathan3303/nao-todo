import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { useEventStore, useProjectStore, useTodoStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import moment from 'moment'
import { getTodo } from '@nao-todo/apis'
import { useUpdateQueue } from './use-update-queue'
import type { Todo } from '@nao-todo/types'

export const useTodoDetails = () => {
    const route = useRoute()
    const router = useRouter()
    const projectStore = useProjectStore()
    const todoStore = useTodoStore()
    const eventStore = useEventStore()
    const updateQueue = useUpdateQueue()

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

    // 结束日期代理
    // const endAt = computed({
    //     get: () => {
    //         if (!shadowTodo.value) return null
    //         return shadowTodo.value.dueDate.endAt
    //     },
    //     set: (dateString: string | null) => {
    //         if (!shadowTodo.value) return
    //         shadowTodo.value.dueDate.endAt = dateString
    //     }
    // })

    // 获取待办
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
    const _updateTodo = async () => {
        if (!shadowTodo.value) return
        const todoId = shadowTodo.value.id
        const newTodo = { ...shadowTodo.value }
        // console.log('[UseDetails/_updateTodo] newTodo', newTodo)
        return await todoStore.doUpdateTodo(todoId, newTodo)
    }

    const { debouncedFn: debouncedUpdateTodo, cancelTimer } = _debounce(_updateTodo, 512)

    // 格式化日期
    const formatDate = (datestring: string) => {
        return moment(datestring).format('YYYY-MM-DD HH:mm')
    }

    // 设置结束日期
    const handleChangeEndAt = (value: string | null) => {
        if (!shadowTodo.value) return
        shadowTodo.value.dueDate.endAt = value
        updateQueue.insertItem({
            todoId: shadowTodo.value.id,
            updateOptions: {
                dueDate: { startAt: shadowTodo.value.dueDate.startAt, endAt: value }
            }
        })
    }

    // 设置优先级
    const handleChangePriority = (value: unknown) => {
        if (!shadowTodo.value) return
        shadowTodo.value.priority = value as Todo['priority']
        updateQueue.insertItem({
            todoId: shadowTodo.value.id,
            updateOptions: {
                priority: value as Todo['priority']
            }
        })
    }

    // 设置状态
    const handleChangeState = (value: unknown) => {
        if (!shadowTodo.value) return
        shadowTodo.value.state = value as Todo['state']
        updateQueue.insertItem({
            todoId: shadowTodo.value.id,
            updateOptions: {
                state: value as Todo['state']
            }
        })
    }

    // 设置所属清单
    const handleMoveToProject = async (projectId: string, projectTitle: string) => {
        if (!shadowTodo.value) return
        shadowTodo.value.projectId = projectId
        shadowTodo.value.project = { title: projectTitle }
        updateQueue.insertItem({
            todoId: shadowTodo.value.id,
            updateOptions: {
                projectId
                // project: { title: projectTitle }
            }
        })
    }

    // 设置完成
    const handleCheckTodo = async () => {
        if (!shadowTodo.value) return
        const newState = (shadowTodo.value.state === 'done' ? 'todo' : 'done') as Todo['state']
        shadowTodo.value.state = newState
        updateQueue.insertItem({
            todoId: shadowTodo.value.id,
            updateOptions: {
                state: newState
            }
        })
    }

    // 设置标签
    const handleUpdateTags = async (tags: Todo['tags']) => {
        if (!shadowTodo.value) return
        shadowTodo.value.tags = tags
        updateQueue.insertItem({
            todoId: shadowTodo.value.id,
            updateOptions: { tags }
        })
    }

    // 删除
    const handleDeleteTodo = async () => {
        if (!shadowTodo.value) return
        const result = await todoStore.deleteTodoWithConfirmation(shadowTodo.value.id)
        if (result) await handleClose()
    }

    // 恢复
    const handleRestoreTodo = async () => {
        if (!shadowTodo.value) return
        const result = await todoStore.restoreTodoWithConfirmation(shadowTodo.value.id)
        if (result) await handleClose()
    }

    // 永久删除
    const handleDeleteTodoPermanently = async () => {
        if (!shadowTodo.value) return
        const result = await todoStore.deleteTodoPermanentlyWithConfirmation(shadowTodo.value.id)
        if (result) await handleClose()
    }

    // 关闭详情
    const handleClose = async () => {
        cancelTimer(true)
        shadowTodo.value = void 0
        const prevRoute = route.matched[route.matched.length - 1]
        if (prevRoute) await router.push(prevRoute)
    }

    // 获取详情
    watchEffect(() => {
        const todoId = route.params.taskId as string
        cancelTimer(true)
        setTimeout(async () => await _getTodo(todoId))
    })

    // 订阅 Store 更新
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

    // 返回
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
