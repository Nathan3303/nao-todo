import { ref, reactive } from 'vue'
import { defineStore } from 'pinia'
import type { Todo, TodoFilter, TodoCountInfo } from './types'
import $axios from './axios'
import type { Project } from '../use-project-store'
import { NueMessage } from 'nue-ui'

export const useTodoStore = defineStore('todoStore', () => {
    const todo = ref<Todo>()
    const todos = ref<Todo[]>([])
    const countInfo = reactive<TodoCountInfo>({
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
            todos.value.splice(index, 1, response.data.data)
            // todo.value = response.data.data
            // todo.value!.updatedAt = response.data.data.updatedAt
            // NueMessage.success('Todo updated successfully')
        } else {
            NueMessage.error(response.data.message)
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
        update
    }
})
