import { ref, watch, computed } from 'vue'
import { useTodoStore, useProjectStore, useUserStore, useEventStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import moment from 'moment'
import type { TodoDetailsEmits, TodoDetailsProps } from './types'
import type { Todo } from '@/stores'

export const useTodoDetails = (props: TodoDetailsProps, emit: TodoDetailsEmits) => {
    const projectStore = useProjectStore()
    const todoStore = useTodoStore()
    const userStore = useUserStore()
    const eventStore = useEventStore()
    const route = useRoute()
    const router = useRouter()

    const { projects } = storeToRefs(projectStore)
    const { events } = storeToRefs(eventStore)
    const shadowTodo = ref<Todo | undefined>()
    const loadingState = ref(false)
    let timer: number | null = null

    const eventsProgress = computed(() => {
        const _e = events.value
        const progress = _e ? _e.filter((event) => event.isDone).length : 0
        const total = _e ? _e.length : 0
        const percentage = total ? Math.floor((progress / total) * 100) : 0
        return `已完成 ${progress}/${total}, ${percentage}%`
    })

    const parseDate = (datestring: string) => {
        return moment(datestring).format('YYYY-MM-DD HH:mm')
    }

    const getTodo = async (todoId: Todo['id']) => {
        const userId = userStore.user!.id
        if (!todoId) return
        loadingState.value = true
        try {
            let todo = await todoStore.findLocal(todoId)
            if (!todo) {
                const response = await todoStore.toFindOne(userId, todoId)
                todo = response.code === '20000' ? response.data : void 0
            }
            shadowTodo.value = todo as Todo
            todoStore.todo = todo as Todo
        } catch (error) {
            console.warn(error)
        } finally {
            loadingState.value = false
        }
    }

    const updateTodo = (delay?: number) => {
        return new Promise((resolve) => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(async () => {
                loadingState.value = true
                const userId = userStore.user!.id
                if (!shadowTodo.value) return
                const todoId = shadowTodo.value.id
                const newTodo = { ...shadowTodo.value }
                const response = await todoStore.update2(userId, todoId, newTodo)
                if (response.code === '20000') {
                    requestIdleCallback(() => {
                        todoStore.updateLocal(todoId, newTodo)
                    })
                    // shadowTodo.value = response.data
                    resolve(response)
                }
                loadingState.value = false
                timer = null
            }, delay)
        })
    }

    const handleChangeEndAt = (value: string | null) => {
        // console.log(value)
        shadowTodo.value!.dueDate.endAt = value
        updateTodo()
    }

    const handleChangePriority = (value: unknown) => {
        // console.log(value)
        shadowTodo.value!.priority = value as Todo['priority']
        updateTodo()
    }

    const handleChangeState = (value: unknown) => {
        // console.log(value)
        shadowTodo.value!.state = value as Todo['state']
        updateTodo()
    }

    const handleClose = () => {
        shadowTodo.value = void 0
        const prevRoute = route.matched[route.matched.length - 2]
        if (prevRoute) {
            router.push(prevRoute)
        }
    }

    const handleMoveToProject = async (projectId: string) => {
        shadowTodo.value!.projectId = projectId
        await updateTodo(0)
        document.querySelector('body')?.click()
        emit('refresh')
    }

    const handleCheckTodo = async () => {
        if (!shadowTodo.value) return
        shadowTodo.value.isDone = !shadowTodo.value.isDone
        await updateTodo(0)
    }

    watch(
        () => route.params.taskId,
        (newValue) => {
            requestIdleCallback(() => {
                getTodo(newValue as string)
            })
        },
        { immediate: true }
    )

    return {
        projects,
        shadowTodo,
        loadingState,
        eventsProgress,
        parseDate,
        updateTodo,
        handleChangeEndAt,
        handleChangePriority,
        handleChangeState,
        handleClose,
        handleMoveToProject,
        handleCheckTodo
    }
}
