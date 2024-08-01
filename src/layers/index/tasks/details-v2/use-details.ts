import { ref, watch, computed } from 'vue'
import { useTodoStore, useProjectStore, useUserStore, useEventStore } from '@/stores'
import { storeToRefs } from 'pinia'
import moment from 'moment'
import type { TodoDetailsEmits, TodoDetailsProps } from './types'
import type { Todo } from '@/stores'

const projectStore = useProjectStore()
const todoStore = useTodoStore()
const userStore = useUserStore()
const eventStore = useEventStore()

export const useTodoDetails = (props: TodoDetailsProps, emit: TodoDetailsEmits) => {
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

    const updateTodo = (delay?: any) => {
        return new Promise((resolve) => {
            delay = delay === 0 ? 0 : 1000
            if (timer) clearTimeout(timer)
            timer = setTimeout(async () => {
                loadingState.value = true
                const { todo } = props
                if (!shadowTodo.value || !todo) return
                const response = await todoStore.update(todo.id!, shadowTodo.value)
                if (response.code === '20000') {
                    shadowTodo.value = response.data
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
        emit('closeTodoDetails')
    }

    const handleMoveToProject = async (projectId: string) => {
        shadowTodo.value!.projectId = projectId
        await updateTodo(0)
        document.querySelector('body')?.click()
        emit('refresh')
    }

    watch(
        () => props.todo,
        (newValue) => {
            shadowTodo.value = newValue ? { ...newValue } : void 0
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
        handleMoveToProject
    }
}
