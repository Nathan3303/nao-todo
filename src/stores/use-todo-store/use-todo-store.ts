import { ref, reactive } from 'vue'
import { defineStore } from 'pinia'
import type { Todo, TodoFilter, TodoCountInfo, TodoEvent } from './types'
import type { Project } from '../use-project-store'
import { NueMessage } from 'nue-ui'
import { naoTodoServer as $axios } from '@/axios'

export const useTodoStore = defineStore('todoStore', () => {
    const todo = ref<Todo>()
    const todos = ref<Todo[]>([])
    const countInfo = reactive<TodoCountInfo>({
        length: 0,
        count: 0,
        total: 0,
        byState: { todo: 0, 'in-progress': 0, done: 0 },
        byPriority: { low: 0, medium: 0, high: 0 }
    })
    const pageInfo = reactive({ page: 1, limit: 10, totalPages: 0 })
    const filterInfo = ref<TodoFilter>({ name: '', state: '', priority: '' })

    function parseFilterInfoToQuery() {
        const { name, state, priority } = filterInfo.value
        const query = []
        if (name) query.push(`name=${name}`)
        if (state) query.push(`state=${state}`)
        if (priority) query.push(`priority=${priority}`)
        return query.join('&')
    }

    async function getTodosByProjectId(projectId: Project['id']) {
        const { page, limit } = pageInfo
        const filterQuery = parseFilterInfoToQuery()
        const uri = `/todos?projectId=${projectId}&page=${page}&limit=${limit}&${filterQuery}`
        const response = await $axios.get(uri)
        if (response.data.code === '20000') {
            const { todos: _tds, payload: _pl } = response.data.data
            todos.value = _tds
            countInfo.length = _pl.countInfo.length
            countInfo.count = _pl.countInfo.count
            countInfo.total = _pl.countInfo.total
            countInfo.byState = _pl.countInfo.byState
            countInfo.byPriority = _pl.countInfo.byPriority
            pageInfo.page = _pl.pageInfo.page
            pageInfo.limit = _pl.pageInfo.limit
            pageInfo.totalPages = _pl.pageInfo.totalPages
        } else {
            NueMessage.error(response.data.message)
        }
        return response.data
    }

    async function createTodo(projectId: string, name: string) {
        const data = { name, projectId }
        const response = await $axios.post('/todo', data)
        if (response.data.code === '20000') {
            NueMessage.success('Todo created successfully')
        } else {
            NueMessage.error(response.data.message)
        }
        return response.data
    }

    async function remove(id: Todo['id']) {
        if (todo.value && id === todo.value.id) return
        const response = await $axios.delete('/todo' + `?id=${id}`)
        if (response.data.code === '20000') {
            const index = todos.value.findIndex((todo) => todo.id === id)
            todos.value.splice(index, 1)
            NueMessage.success('Todo removed successfully')
        } else {
            NueMessage.error(response.data.message)
        }
        return response.data
    }

    async function getTodoById(id: Todo['id']) {
        const response = await $axios.get('/todo' + `?id=${id}`)
        if (response.data.code === '20000') {
            todo.value = response.data.data
        }
        return response.data
    }

    async function update(id: Todo['id'], newTodo: Partial<Todo>) {
        const response = await $axios.put('/todo' + `?id=${id}`, newTodo)
        if (response.data.code === '20000') {
            const index = todos.value.findIndex((t) => t.id === id)
            todos.value.splice(index, 1, { ...response.data.data, justUpdated: true })
            // todo.value = response.data.data
            // todo.value!.updatedAt = response.data.data.updatedAt
            // NueMessage.success('Todo updated successfully')
        } else {
            NueMessage.error(response.data.message)
        }
        return response.data
    }

    async function getTodoStatesAnalysis() {
        const response = await $axios.get('/analysis?target=todo-overview')
        if (response.data.code === '20000') {
            console.log(response.data.data)
        }
        return response.data
    }

    const createTodoEvent = async (todoId: Todo['id'], newTodoEvent: Partial<TodoEvent>) => {
        const data = { todoId, ...newTodoEvent }
        const response = await $axios.post('/event', data)
        if (response.data.code === '20000') {
            if (!todo.value?.events) {
                todo.value!.events = []
            }
            const _n_todo: TodoEvent = {
                title: newTodoEvent.title as string,
                id: response.data.data._id,
                isDone: false,
                isTopped: false
            }
            todo.value!.events.unshift(_n_todo)
        }
        return response.data
    }

    const updateTodoEvent = async (id: TodoEvent['id'], newTodoEvent: Partial<TodoEvent>) => {
        const response = await $axios.put('/event', newTodoEvent, { params: { id } })
        if (response.data.code === '20000') {
            // console.log(response.data.data)
            if (!todo.value?.events) {
                todo.value!.events = []
            }
            for (let i = 0, event; i < todo.value!.events.length; i++) {
                event = todo.value!.events[i]
                if (event.id === id) {
                    event = { ...event, ...newTodoEvent }
                    todo.value!.events.splice(i, 1, event)
                    break
                }
            }
        }
        return response.data
    }

    const deleteTodoEvent = async (id: TodoEvent['id']) => {
        const response = await $axios.delete('/event', { params: { id } })
        if (response.data.code === '20000') {
            if (!todo.value?.events) {
                todo.value!.events = []
            }
            for (let i = 0, event; i < todo.value!.events.length; i++) {
                event = todo.value!.events[i]
                if (event.id === id) {
                    todo.value!.events.splice(i, 1)
                    break
                }
            }
        }
        return response.data
    }

    return {
        todos,
        todo,
        pageInfo,
        countInfo,
        filterInfo,
        getTodosByProjectId,
        createTodo,
        remove,
        getTodoById,
        update,
        getTodoStatesAnalysis,
        createTodoEvent,
        updateTodoEvent,
        deleteTodoEvent
    }
})
