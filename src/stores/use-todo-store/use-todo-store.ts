import { ref, reactive, watch } from 'vue'
import { defineStore } from 'pinia'
import { naoTodoServer as $axios } from '@/axios'
import { defaultColumns, defaultTodo } from './constants'
import type { Todo, TodoFilter, TodoCountInfo, TodoSortOptions, TodoColumnOptions } from './types'
import type { Project, User } from '..'

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
    const columnOptions = ref<TodoColumnOptions>(defaultColumns)

    /**
     * Stringify filter info
     * @param specFilterInfo specify filter info
     * @returns string
     */
    const _stringifyFilterInfo = (specFilterInfo?: TodoFilter) => {
        const query: string[] = []
        const _filterInfo = specFilterInfo || filterInfo.value
        Object.keys(_filterInfo).forEach((key) => {
            const value = _filterInfo[key as keyof TodoFilter]
            query.push(`${key}=${value}`)
        })
        return query.join('&')
    }

    const _stringifySortInfo = (specSortInfo?: TodoSortOptions) => {
        let { field, order } = specSortInfo || sortInfo
        if (!field && !order) return ''
        order = order || 'asc'
        return `sort=${field}:${order}`
    }

    const _mergeFilterInfo = (newOne: Partial<TodoFilter>) => {
        const newFilterInfo = { ...filterInfo.value, ...newOne }
        filterInfo.value = newFilterInfo
    }

    const _mergeColumnOptions = (newOne: Partial<TodoColumnOptions>) => {
        columnOptions.value = { ...columnOptions.value, ...newOne } as TodoColumnOptions
    }

    const _resetOptions = () => {
        filterInfo.value = {}
        pageInfo.page = 1
        pageInfo.limit = 20
        sortInfo.field = ''
        sortInfo.order = ''
        columnOptions.value = defaultColumns
    }

    const _reset = () => {
        todos.value = []
        _resetOptions()
    }

    const _get = async (userId: User['id'], specFilterInfo?: TodoFilter) => {
        try {
            const { page, limit } = pageInfo
            let URI = `/todos?userId=${userId}`
            URI += `&page=${page}&limit=${limit}`
            URI += '&' + _stringifyFilterInfo(specFilterInfo)
            const sortQueryString = _stringifySortInfo()
            URI += sortQueryString ? `&${sortQueryString}` : ''
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
        // console.log('[useTodoStore] _updatingCompare:', target, updateInfo)
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

    const _updateBatch = async (
        userId: User['id'],
        todoIds: Todo['id'][],
        updateInfo: Partial<Todo>
    ) => {
        try {
            const URI = `/todos?userId=${userId}`
            const {
                data: { data, code }
            } = await $axios.put(URI, { todoIds, updateInfo })
            const res = code === '20000' ? data : null
            // console.log('[todoStore] _updateBatch:', URI, updateInfo, res)
            return res
        } catch (e) {
            console.warn('[todoStore] _updateBatch:', e)
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
        const responseData = await _get(userId)
        if (!responseData) return
        const { todos: _tds, payload } = responseData
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

    const updateBatch = async (
        userId: User['id'],
        todoIds: Todo['id'][],
        updateInfo: Partial<Todo>
    ) => {
        const updateResult = await _updateBatch(userId, todoIds, updateInfo)
        if (!updateResult) return
        updateBatchLocal(todoIds, updateInfo)
        return updateResult
    }

    const remove = async (userId: User['id'], todoId: Todo['id']) => {
        const removeResult = await _remove(userId, todoId)
        if (!removeResult) return
        // removeLocal(todoId)
        get(userId)
        return removeResult
    }

    const create = async (userId: User['id'], createInfo: Partial<Todo>) => {
        const createResult = await _create(userId, createInfo)
        if (!createResult) return
        // createLocal({ ...createInfo, ...createResult })
        get(userId)
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

    const toFilterLocal = (todoId: Todo['id']) => {
        const todo = findLocal(todoId)
        if (!todo) return null
        return todo
    }

    const updateLocal = (todoId: Todo['id'], updateInfo: Partial<Todo>) => {
        const oldTodoIndex = findIndexLocal(todoId)
        const oldTodo = todos.value[oldTodoIndex]
        if (!oldTodo) return
        const newTodo = { ...oldTodo, ...updateInfo }
        todos.value[oldTodoIndex] = newTodo
    }

    const updateBatchLocal = (todoIds: Todo['id'][], updateInfo: Partial<Todo>) => {
        todoIds.forEach((todoId) => {
            updateLocal(todoId, updateInfo)
        })
    }

    const removeLocal = async (todoId: Todo['id']) => {
        const todoIndex = findIndexLocal(todoId)
        todos.value.splice(todoIndex, 1)
        countInfo.length--
        countInfo.count--
    }

    const createLocal = (createInfo: Partial<Todo>) => {
        const newTodoTemplate = defaultTodo as Todo
        const newTodo = { ...newTodoTemplate, ...createInfo }
        todos.value.unshift(newTodo)
        if (todos.value.length >= pageInfo.limit) {
            todos.value.pop()
        } else {
            countInfo.length++
        }
        countInfo.count++
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

    // Others

    const setOptionsByProjectPreference = (preference: Partial<Project['preference']>) => {
        if (!preference) return
        if (preference.filterInfo) {
            filterInfo.value = preference.filterInfo
        }
        if (preference.sortInfo) {
            sortInfo.field = preference.sortInfo.field
            sortInfo.order = preference.sortInfo.order
        }
        if (preference.columns) {
            columnOptions.value = preference.columns
        }
    }

    return {
        todos,
        filterInfo,
        sortInfo,
        pageInfo,
        countInfo,
        columnOptions,
        mergeFilterInfo: _mergeFilterInfo,
        mergeColumnOptions: _mergeColumnOptions,
        updatingCompare: _updatingCompare,
        resetOptions: _resetOptions,
        reset: _reset,
        get,
        initialize,
        update,
        updateBatch,
        remove,
        create,
        findIndexLocal,
        findLocal,
        toFilterLocal,
        updateLocal,
        updateBatchLocal,
        removeLocal,
        createLocal,
        toGetted,
        toFinded,
        toFindedOne,
        setOptionsByProjectPreference
    }
})
