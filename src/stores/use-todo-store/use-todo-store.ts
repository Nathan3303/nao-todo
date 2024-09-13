import { ref, reactive } from 'vue'
import { defineStore } from 'pinia'
import { naoTodoServer as $axios } from '@/axios'
import type { Todo, TodoFilter, TodoCountInfo, TodoSortOptions } from './types'
import type { User } from '..'

export const useTodoStore = defineStore('todoStore', () => {
    const todos = ref<Todo[]>([])
    const filterInfo = ref<TodoFilter>({})
    const pageInfo = reactive({ page: 1, limit: 20, totalPages: 0 })
    const sortInfo = reactive<TodoSortOptions>({ field: '', order: '' })
    const countInfo = reactive<TodoCountInfo>({
        length: 0,
        count: 0,
        total: 0,
        byState: { todo: 0, 'in-progress': 0, done: 0 },
        byPriority: { low: 0, medium: 0, high: 0 }
    })

    // Inner methods

    const _stringifyFilterInfo = (specFilterInfo?: TodoFilter) => {
        const query: string[] = []
        const _filterInfo = specFilterInfo || filterInfo.value
        Object.keys(_filterInfo).forEach((key) => {
            const value = _filterInfo[key as keyof TodoFilter]
            query.push(`${key}=${value}`)
        })
        return query.join('&')
    }

    const _mergeFilterInfo = (newOne: Partial<TodoFilter>) => {
        const newFilterInfo = { ...filterInfo.value, ...newOne }
        filterInfo.value = newFilterInfo
    }

    const _reset = () => {
        todos.value = []
        filterInfo.value = {}
    }

    const _get = async (userId: User['id'], specFilterInfo?: TodoFilter) => {
        try {
            const { page, limit } = pageInfo
            const filterQueryString = _stringifyFilterInfo(specFilterInfo)
            const pageQueryString = `page=${page}&limit=${limit}`
            const sortQueryString = `sort=${sortInfo.field}:${sortInfo.order}`
            const URI = `/todos?userId=${userId}&${pageQueryString}&${filterQueryString}&${sortQueryString}`
            const {
                data: { data, code }
            } = await $axios.get(URI)
            const res = code === '20000' ? data : null
            // console.log('[todoStore] _get:', URI, res);
            return res
        } catch (e) {
            console.warn('[todoStore] _get:', e)
        }
    }

    const _updatingCompare = (todoId: Todo['id'], updateInfo: Partial<Todo>) => {
        const targetIdx = findIndexLocal(todoId)
        const target = todos.value[targetIdx]
        const isNeedToUpdate = Object.keys(updateInfo).some((key) => {
            const value = updateInfo[key as keyof Todo]
            return target[key as keyof Todo] !== value
        })
        return { targetIdx, isNeedToUpdate }
    }

    const _update = async (userId: User['id'], todoId: Todo['id'], updateInfo: Partial<Todo>) => {
        try {
            const URI = `/todo?userId=${userId}&todoId=${todoId}`
            const {
                data: { data, code }
            } = await $axios.put(URI, updateInfo)
            const res = code === '20000' ? data : null
            // console.log('[todoStore] _update:', URI, updateInfo, res)
            return res
        } catch (e) {
            console.warn('[todoStore] _update:', e)
        }
    }

    const _remove = async (userId: User['id'], todoId: Todo['id']) => {
        try {
            const URI = `/todo?userId=${userId}&todoId=${todoId}`
            const {
                data: { data, code }
            } = await $axios.delete(URI)
            return code === '20000' ? data : null
        } catch (e) {
            console.warn('[todoStore] _remove:', e)
        }
    }

    const _create = async (userId: User['id'], createInfo: Partial<Todo>) => {
        try {
            createInfo = { ...createInfo, userId }
            const {
                data: { data, code }
            } = await $axios.post('/todo', createInfo)
            const res = code === '20000' ? { ...data, id: data._id } : null
            // console.log('[todoStore] _create:', createInfo, res)
            return res
        } catch (e) {
            console.warn('[todoStore] _create:', e)
        }
    }

    // Getter which from backend

    const get = async (userId: User['id'], filterInfo?: Partial<TodoFilter>) => {
        if (filterInfo) _mergeFilterInfo(filterInfo)
        const { todos: _tds, payload } = await _get(userId)
        if (!todos) return
        todos.value = _tds as Todo[]
        pageInfo.limit = payload.pageInfo.limit
        pageInfo.page = payload.pageInfo.page
        pageInfo.totalPages = payload.pageInfo.totalPages
        countInfo.count = payload.countInfo.count
        countInfo.byPriority = payload.countInfo.byPriority
        countInfo.byState = payload.countInfo.byState
        countInfo.length = payload.countInfo.length
        countInfo.total = payload.countInfo.total
        return todos
    }

    const initialize = async (userId: User['id'], filterInfo: Partial<TodoFilter>) => {
        _reset()
        await get(userId, filterInfo)
    }

    const update = async (userId: User['id'], todoId: Todo['id'], updateInfo: Partial<Todo>) => {
        const updateResult = await _update(userId, todoId, updateInfo)
        if (!updateResult) return
        updateLocal(todoId, updateInfo)
        return updateResult
    }

    const remove = async (userId: User['id'], todoId: Todo['id']) => {
        const removeResult = await _remove(userId, todoId)
        if (!removeResult) return
        removeLocal(todoId)
        return removeResult
    }

    const create = async (userId: User['id'], createInfo: Partial<Todo>) => {
        const createResult = await _create(userId, createInfo)
        if (!createResult) return
        createLocal({ ...createInfo, ...createResult })
        return createResult
    }

    // Getter which from local

    const findIndexLocal = (todoId: Todo['id']) => {
        return todos.value.findIndex((todo) => todo.id === todoId)
    }

    const findLocal = (todoId: Todo['id']) => {
        const todoIndex = findIndexLocal(todoId)
        const res = todoIndex !== -1 ? todos.value[todoIndex] : null
        return res as Todo | null
    }

    const updateLocal = (todoId: Todo['id'], updateInfo: Partial<Todo>) => {
        const oldTodoIndex = findIndexLocal(todoId)
        const oldTodo = todos.value[oldTodoIndex]
        if (!oldTodo) return
        const newTodo = { ...oldTodo, ...updateInfo }
        todos.value[oldTodoIndex] = newTodo
    }

    const removeLocal = async (todoId: Todo['id']) => {
        const todoIndex = findIndexLocal(todoId)
        todos.value.splice(todoIndex, 1)
    }

    const createLocal = (createInfo: Partial<Todo>) => {
        if (countInfo.length >= pageInfo.limit) {
            countInfo.total++
            return
        }
        const newTodoTemplate: Todo = {
            id: '',
            userId: '',
            projectId: '',
            name: '',
            description: '',
            status: 'todo',
            state: 'todo',
            progress: { total: 0, finished: 0 },
            priority: 'low',
            createdAt: '',
            updatedAt: '',
            dueDate: { startAt: null, endAt: null },
            events: [],
            isPinned: false,
            isDone: false,
            isDeleted: false,
            tags: [],
            tagsInfo: [],
            project: {}
        }
        const newTodo = { ...newTodoTemplate, ...createInfo }
        todos.value.push(newTodo)
    }

    // Getter which is pure function and from backend

    const toGetted = async (userId: User['id']) => {
        const getted = await _get(userId)
        return getted as Todo[] | null
    }

    const toFinded = async (userId: User['id'], filterInfo: TodoFilter) => {
        const finded = await _get(userId, filterInfo)
        return finded as Todo[] | null
    }

    const toFindedOne = async (userId: User['id'], todoId: Todo['id']) => {
        const finded = await _get(userId, { id: todoId })
        const { todos } = finded
        const res = Array.isArray(todos) ? todos[0] : todos
        return res as Todo | null
    }

    return {
        todos,
        filterInfo,
        sortInfo,
        pageInfo,
        countInfo,
        mergeFilterInfo: _mergeFilterInfo,
        updatingCompare: _updatingCompare,
        get,
        initialize,
        update,
        remove,
        create,
        findIndexLocal,
        findLocal,
        updateLocal,
        removeLocal,
        createLocal,
        toGetted,
        toFinded,
        toFindedOne
    }
})
