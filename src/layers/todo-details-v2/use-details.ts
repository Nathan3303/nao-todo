import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { useTodoStore, useProjectStore, useEventStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import {
    getTodo,
    updateTodo,
    removeTodoWithConfirm,
    restoreTodoWithConfirm
} from '@/utils/todo-handlers'
import moment from 'moment'
import type { TodoDetailsEmits, TodoDetailsProps } from './types'
import type { ProjectFilterOptions, Todo } from '@/stores'

export const useTodoDetails = (props: TodoDetailsProps, emit: TodoDetailsEmits) => {
    const route = useRoute()
    const router = useRouter()
    const projectStore = useProjectStore()
    const todoStore = useTodoStore()
    const eventStore = useEventStore()

    const priorityOptions = [
        { label: '低', value: 'low' },
        { label: '中', value: 'medium' },
        { label: '高', value: 'high' }
    ]
    const stateOptions = [
        { label: '代办', value: 'todo' },
        { label: '正在进行', value: 'in-progress' },
        { label: '已完成', value: 'done' }
    ]

    const { events } = storeToRefs(eventStore)
    const shadowTodo = ref<Todo | undefined>()
    const loadingState = ref(false)
    const isGetting = ref(false)
    let unSubscribe: Function | null = null

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

    const activeProjects = computed(() => {
        const filterInfo: ProjectFilterOptions = {
            isArchived: false,
            isDeleted: false
        }
        return projectStore._toFiltered(filterInfo)
    })

    const _getTodo = async (todoId: Todo['id']) => {
        if (!todoId) {
            shadowTodo.value = void 0
            return
        }
        let res = todoStore.toFilterLocal(todoId)
        if (!res) {
            isGetting.value = true
            res = await getTodo(todoId)
        }
        shadowTodo.value = res as Todo
        isGetting.value = false
    }

    const _debounce = (callback: () => void | Promise<any>, delay: number) => {
        let timer: number | null = null
        return () => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => {
                callback()
                timer = null
            }, delay)
        }
    }

    const _updateTodo = async () => {
        loadingState.value = true
        if (shadowTodo.value) {
            const todoId = shadowTodo.value.id
            await updateTodo(todoId, { ...shadowTodo.value })
        }
        loadingState.value = false
    }

    const debouncedUpdateTodo = _debounce(_updateTodo, 1024)

    const formatDate = (datestring: string) => {
        const dateString = moment(datestring).format('YYYY-MM-DD HH:mm')
        return dateString
    }

    const handleChangeEndAt = (value: string | null) => {
        if (!shadowTodo.value) return
        shadowTodo.value.dueDate.endAt = value
        debouncedUpdateTodo()
    }

    const handleChangePriority = (value: unknown) => {
        if (!shadowTodo.value) return
        shadowTodo.value.priority = value as Todo['priority']
        debouncedUpdateTodo()
    }

    const handleChangeState = (value: unknown) => {
        if (!shadowTodo.value) return
        shadowTodo.value.state = value as Todo['state']
        debouncedUpdateTodo()
    }

    const handleMoveToProject = async (projectId: string, projectTitle: string) => {
        if (!shadowTodo.value) return
        shadowTodo.value.projectId = projectId
        shadowTodo.value.project = { title: projectTitle }
        debouncedUpdateTodo()
    }

    const handleCheckTodo = async () => {
        if (!shadowTodo.value) return
        shadowTodo.value.isDone = !shadowTodo.value.isDone
        debouncedUpdateTodo()
    }

    const handleDeleteTodo = async () => {
        if (!shadowTodo.value) return
        const todoId = shadowTodo.value.id
        try {
            const removeResult = await removeTodoWithConfirm(todoId)
            if (removeResult.id === todoId) handleClose()
        } catch (error) {
            console.info('handleDeleteTodo error: ', error)
        }
    }

    const handleRestoreTodo = async () => {
        if (!shadowTodo.value) return
        const todoId = shadowTodo.value?.id
        try {
            const restoreResult = await restoreTodoWithConfirm(todoId)
            if (restoreResult.id === todoId) handleClose()
        } catch (error) {
            console.info('handleRestoreTodo error: ', error)
        }
    }

    const handleUpdateTags = async (tags: Todo['tags']) => {
        if (!shadowTodo.value) return
        shadowTodo.value.tags = tags
        debouncedUpdateTodo()
    }

    const handleClose = () => {
        shadowTodo.value = void 0
        const prevRoute = route.matched[route.matched.length - 1]
        if (prevRoute) {
            router.push(prevRoute)
        }
    }

    watch(
        () => route.params.taskId,
        (newValue) => setTimeout(async () => await _getTodo(newValue as string)),
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
        priorityOptions,
        stateOptions,
        formatDate,
        updateTodo: debouncedUpdateTodo,
        handleChangeEndAt,
        handleChangePriority,
        handleChangeState,
        handleClose,
        handleMoveToProject,
        handleCheckTodo,
        handleDeleteTodo,
        handleRestoreTodo,
        handleUpdateTags
    }
}
