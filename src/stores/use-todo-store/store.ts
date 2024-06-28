import { ref, reactive, watch } from 'vue'
import { defineStore } from 'pinia'
import type { Todo, TodoFilter } from './types'
import $axios from './axios'
import { useProjectStore, type Project } from '../use-project-store'
import { NueMessage } from 'nue-ui'

export const useTodoStore = defineStore('todoStore', () => {
    const todo = ref<Todo>()
    const todos = ref<Todo[]>([])
    const pageInfo = reactive({ page: 1, limit: 10, totalPages: 0 })
    const countInfo = reactive({ count: 0, total: 0 })
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
        // const uri = `/todos?projectId=${projectId}&page=${page}&limit=${limit}`
        const response = await $axios.get(uri)
        if (response.data.code === '20000') {
            const { todos: _tds, payload: _pl } = response.data.data
            todos.value = _tds
            pageInfo.page = _pl.page
            pageInfo.limit = _pl.limit
            pageInfo.totalPages = _pl.totalPages
            countInfo.count = _pl.count
            countInfo.total = _pl.total
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

    async function update(id: Todo['id'], todo: Partial<Todo>) {
        const response = await $axios.put('/todo' + `?id=${id}`, todo)
        if (response.data.code === '20000') {
            const index = todos.value.findIndex((t) => t.id === id)
            const _todo = { ...todos.value[index], ...todo }
            todos.value.splice(index, 1, _todo)
            NueMessage.success('Todo updated successfully')
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
