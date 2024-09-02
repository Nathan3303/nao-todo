import { ref, watch, computed } from 'vue'
import { useTodoStore, useProjectStore, useEventStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { NueConfirm } from 'nue-ui'
import { updateTodo, removeTodoWithConfirm, restoreTodoWithConfirm } from '@/utils/todo-handlers'
import moment from 'moment'
import type { TodoDetailsEmits, TodoDetailsProps } from './types'
import type { Todo } from '@/stores'

export const useTodoDetails = (props: TodoDetailsProps, emit: TodoDetailsEmits) => {
    const route = useRoute()
    const router = useRouter()
    const projectStore = useProjectStore()
    const todoStore = useTodoStore()
    const eventStore = useEventStore()

    const { projects } = storeToRefs(projectStore)
    const { events } = storeToRefs(eventStore)
    const shadowTodo = ref<Todo | undefined>()
    const loadingState = ref(false)

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

    const _getTodo = async (todoId: Todo['id']) => {
        if (!todoId) {
            shadowTodo.value = void 0
            return
        }
        let todo = todoStore.findLocal(todoId)
        shadowTodo.value = todo as Todo
    }

    const _debounce = (delay: number, callback: () => void | Promise<any>) => {
        let timer: number | null = null
        return () => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(async () => {
                await callback()
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

    const debouncedUpdateTodo = _debounce(500, _updateTodo)

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
        shadowTodo.value.project!.title = projectTitle
        debouncedUpdateTodo()
        // emit('refresh')
    }

    const handleCheckTodo = async () => {
        if (!shadowTodo.value) return
        shadowTodo.value.isDone = !shadowTodo.value.isDone
        debouncedUpdateTodo()
    }

    const handleDeleteTodo = async () => {
        if (!shadowTodo.value) return
        const todoId = shadowTodo.value.id
        await removeTodoWithConfirm(todoId)
        handleClose()
    }

    const handleRestoreTodo = async () => {
        if (!shadowTodo.value) return
        const todoId = shadowTodo.value?.id
        await restoreTodoWithConfirm(todoId)
        handleClose()
    }

    const handleUpdateTags = async (tags: Todo['tags']) => {
        if (!shadowTodo.value) return;
        shadowTodo.value.tags = tags
        debouncedUpdateTodo()
    }

    const handleClose = () => {
        shadowTodo.value = void 0
        const prevRoute = route.matched[route.matched.length - 2]
        if (prevRoute) {
            router.push(prevRoute)
        }
    }

    watch(
        () => route.params.taskId,
        (newValue) => {
            requestIdleCallback(() => {
                _getTodo(newValue as string)
            })
        },
        { immediate: true }
    )

    return {
        projects,
        shadowTodo,
        loadingState,
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
        handleRestoreTodo,
        handleUpdateTags
    }
}
