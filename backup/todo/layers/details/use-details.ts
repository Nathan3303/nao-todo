import { ref, reactive, watch, computed } from 'vue'
import { useTodoStore, useProjectStore } from '@nao-todo/stores'
import { useDateInfo } from '@nao-todo/utils/todo/use-date-info'
import { storeToRefs } from 'pinia'
import moment from 'moment'
import type { Todo, TodoEvent } from '@nao-todo/stores'
import type { TodoDetailsEmits, TodoDetailsProps } from './types'
import type { InputButtonSubmitPayload, TodoEventRowUpdatePayload } from '@nao-todo/components'

const projectStore = useProjectStore()
const todoStore = useTodoStore()
const dateInfo = useDateInfo()

export const useTodoDetails = (props: TodoDetailsProps, emit: TodoDetailsEmits) => {
    const { projects } = storeToRefs(projectStore)
    const shadowTodo = ref<Todo | undefined>()
    const loadingState = ref(false)
    const date = reactive({ startAt: '', endAt: '' })
    let timer: number | null = null

    const dueDateHint = computed(() => {
        const { endAt } = date
        let result = ''
        if (endAt !== '') {
            const _endAt = moment(endAt)
            const diff = _endAt.diff(moment(), 'days')
            if (diff === 0) {
                const minuteDiff = _endAt.diff(moment(), 'minutes')
                if (minuteDiff >= 0) {
                    result = '任务即将结束，不到 1 天'
                } else if (minuteDiff < 0) {
                    result = '任务已结束，不到 1 天'
                }
            } else if (diff < 0) {
                result = `任务已结束，${Math.abs(diff)} 天前`
            } else {
                result = `任务将在 ${diff} 天后结束`
            }
        }
        return result === '' ? '' : `(${result})`
    })

    const eventsProgress = computed(() => {
        if (!shadowTodo.value) return ''
        const events = shadowTodo.value.events
        const progress = events ? events.filter((event) => event.isDone).length : 0
        const total = events ? events.length : 0
        const percentage = total ? Math.floor((progress / total) * 100) : 0
        return `(${progress}/${total}, ${percentage}%)`
    })

    const parseDate = (datestring: string) => {
        return moment(datestring).format('YYYY-MM-DD HH:mm')
    }

    const updateCompare = (oldTodo: Todo, newTodo: Todo) => {
        const projectIdCompare = oldTodo.projectId === newTodo.projectId
        const nameCompare = oldTodo.name === newTodo.name
        const descriptionCompare = oldTodo.description === newTodo.description
        const priorityCompare = oldTodo.priority === newTodo.priority
        const stateCompare = oldTodo.state === newTodo.state
        const dueDateCompare = oldTodo.dueDate === newTodo.dueDate
        // const eventsCompare = oldTodo.events.length === newTodo.events.length
        const pinnedCompare = oldTodo.isPinned === newTodo.isPinned
        return (
            projectIdCompare &&
            nameCompare &&
            descriptionCompare &&
            priorityCompare &&
            stateCompare &&
            dueDateCompare &&
            // eventsCompare &&
            pinnedCompare
        )
    }

    const updateTodo = (delay?: any) => {
        return new Promise((resolve) => {
            delay = delay === 0 ? 0 : 1000
            if (timer) clearTimeout(timer)
            timer = setTimeout(async () => {
                loadingState.value = true
                const { todo } = props
                if (!shadowTodo.value && !todo) return
                const isSame = updateCompare(todo!, shadowTodo.value!)
                if (!isSame) {
                    const response = await todoStore.update(todo?.id!, shadowTodo.value!)
                    if (response.code === '20000') {
                        shadowTodo.value = response.data
                        resolve(response)
                        // NueMessage.success('任务更新成功')
                    }
                }
                loadingState.value = false
                timer = null
            }, delay)
        })
    }

    const handleChangeDate = () => {
        const dueDate = dateInfo.reConvert(date)
        shadowTodo.value!.dueDate = dueDate
        updateTodo()
    }

    const handleSwitchStartDate = (flag: 0 | 1) => {
        if (flag) {
            date.startAt = dateInfo.parseDate(0)
        } else {
            date.startAt = ''
        }
        handleChangeDate()
    }

    const handleSwitchEndDate = (flag: 0 | 1) => {
        if (flag) {
            date.endAt = dateInfo.parseDate(0)
        } else {
            date.endAt = ''
        }
        handleChangeDate()
    }

    const handleInputButtonSubmit = (payload: InputButtonSubmitPayload) => {
        if (!props.todo) return
        const { id: todoId } = props.todo
        const { value } = payload
        loadingState.value = true
        emit('createTodoEvent', todoId, { title: value })
        setTimeout(() => (loadingState.value = false), 512)
    }

    const handleUpdateTodoEvent = (event: TodoEventRowUpdatePayload) => {
        const id = event.id
        const newTodoEvent = event
        loadingState.value = true
        emit('updateTodoEvent', id, newTodoEvent)
        setTimeout(() => (loadingState.value = false), 512)
    }

    const handleDeleteTodoEvent = async (id: TodoEvent['id']) => {
        loadingState.value = true
        await todoStore.deleteTodoEvent(id)
        setTimeout(() => (loadingState.value = false), 512)
    }

    const handleClose = () => {
        emit('closeTodoDetails')
    }

    const handleMoveToProject = async (projectId: string) => {
        // const project = projects.value.find((item) => item.id === projectId)
        shadowTodo.value!.projectId = projectId
        await updateTodo(0)
        document.querySelector('body')?.click();
        emit('refresh')
        // console.log(project);
        // NueConfirm({
        //     title: '移动任务',
        //     content: `确定要移动任务到 "${project?.title}" 项目吗？`,
        //     confirmButtonText: '确定',
        //     cancelButtonText: '取消'
        // }).then(
        //     async () => {
        //         shadowTodo.value!.projectId = projectId
        //         // shadowTodo.value!.project = project as Project
        //         await updateTodo(0)
        //         emit('refresh')
        //     },
        //     () => {}
        // )
    }

    watch(
        () => props.todo,
        (newValue) => {
            shadowTodo.value = newValue ? { ...newValue } : void 0
            const _date = dateInfo.convert(shadowTodo.value?.dueDate)
            date.startAt = _date.startAt
            date.endAt = _date.endAt
        },
        { immediate: true }
    )

    return {
        projects,
        shadowTodo,
        loadingState,
        date,
        dueDateHint,
        eventsProgress,
        parseDate,
        updateTodo,
        handleChangeDate,
        handleSwitchStartDate,
        handleSwitchEndDate,
        handleInputButtonSubmit,
        handleUpdateTodoEvent,
        handleDeleteTodoEvent,
        handleClose,
        handleMoveToProject
    }
}
