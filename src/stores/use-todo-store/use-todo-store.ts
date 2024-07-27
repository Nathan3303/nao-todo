import { ref, reactive, watch } from 'vue'
import { defineStore } from 'pinia'
import { NueMessage } from 'nue-ui'
import { naoTodoServer as $axios } from '@/axios'
import { useUserStore } from '..'
import moment from 'moment'
import type { Todo, TodoFilter, TodoCountInfo, TodoEvent } from './types'
import type { Project, User } from '..'

export const useTodoStore = defineStore('todoStore', () => {
    const userStore = useUserStore()
    const todo = ref<Todo>()
    const todos = ref<Todo[]>([])
    const AllTodos = ref<Todo[]>([])
    const countInfo = reactive<TodoCountInfo>({
        length: 0,
        count: 0,
        total: 0,
        byState: { todo: 0, 'in-progress': 0, done: 0 },
        byPriority: { low: 0, medium: 0, high: 0 }
    })
    const pageInfo = reactive({ page: 1, limit: 20, totalPages: 0 })
    const filterInfo = ref<TodoFilter>({})
    const reminderQueen = ref<{ index: number; id: Todo['id']; time: string }[]>([])
    let reminderTimer: number | null = null

    function parseFilterInfoToQuery(specFilterInfo?: TodoFilter) {
        const query: string[] = []
        const _filterInfo = specFilterInfo || filterInfo.value
        Object.keys(_filterInfo).forEach((key) => {
            const value = _filterInfo[key as keyof TodoFilter]
            query.push(`${key}=${value}`)
        })
        const queryString = query.join('&')
        return queryString
    }

    async function getTodosByProjectId(projectId: Project['id']) {
        const { page, limit } = pageInfo
        const filterQuery = parseFilterInfoToQuery()
        const uri = `/todos?projectId=${projectId}&page=${page}&limit=${limit}&${filterQuery}`
        console.log(uri)
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

    async function createTodo(projectId: string, name: string, userId: User['id']) {
        const data = { name, projectId, userId }
        const response = await $axios.post('/todo', data)
        if (response.data.code === '20000') {
            NueMessage.success('待办创建成功')
        } else {
            NueMessage.error(response.data.message)
        }
        return response.data
    }

    async function remove(id: Todo['id']) {
        // if (todo.value && id === todo.value.id) return
        const response = await $axios.delete('/todo' + `?id=${id}`)
        if (response.data.code === '20000') {
            const index = todos.value.findIndex((todo) => todo.id === id)
            todos.value.splice(index, 1)
            NueMessage.success('待办删除成功')
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
            // console.log(todo.value, response.data.data)
            todo.value = response.data.data
            const index = todos.value.findIndex((todo) => todo.id === id)
            todos.value[index] = response.data.data
        } else {
            NueMessage.error(response.data.message)
        }
        return response.data
    }

    async function getTodoStatesAnalysis(projectId: Project['id']) {
        const response = await $axios.get(`/analysis?target=todo-overview&projectId=${projectId}`)
        if (response.data.code === '20000') {
            // console.log(response.data.data)
        }
        return response.data
    }

    const createTodoEvent = async (todoId: Todo['id'], newTodoEvent: Partial<TodoEvent>) => {
        const data = { todoId, ...newTodoEvent }
        const response = await $axios.post('/event', data)
        if (response.data.code === '20000') {
            // if (!todo.value?.events) {
            //     todo.value!.events = []
            // }
            // const _n_todo: TodoEvent = {
            //     title: newTodoEvent.title as string,
            //     id: response.data.data._id,
            //     isDone: false,
            //     isTopped: false
            // }
            // todo.value!.events.push(_n_todo)
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
                // console.log(event, newTodoEvent)
                if (event.id === id) {
                    event = { ...event, ...newTodoEvent }
                    todo.value!.events[i].title = event.title
                    todo.value!.events[i].isDone = event.isDone
                    todo.value!.events[i].isTopped = event.isTopped
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

    const getTodosByDate = async (userId: User['id'], startDate: string, endDate: string) => {}

    const getAllTodos = async (userId: User['id']) => {
        const { page, limit } = pageInfo
        const filterQuery = parseFilterInfoToQuery()
        const uri = `/todos?userId=${userId}&page=${page}&limit=${limit}&${filterQuery}`
        const response = await $axios.get(uri)
        if (response.data.code === '20000') {
            const { todos: _tds, payload: _pl } = response.data.data
            // todos.value = _tds
            AllTodos.value = _tds
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

    const getTodosByFilterInfo = async (userId: User['id'], specFilterInfo: TodoFilter) => {
        const oldFilterInfo = filterInfo.value
        const newFilterInfo = { ...oldFilterInfo, ...specFilterInfo }
        filterInfo.value = newFilterInfo
        // const response = await getTodosByProjectId(projectId)
        const response = await get(userId)
        filterInfo.value = oldFilterInfo
        return response
    }

    watch(
        () => AllTodos.value,
        () => {
            if (!AllTodos.value.length) return
            reminderQueen.value = []
            for (let i = 0; i < AllTodos.value.length; i++) {
                const todo = AllTodos.value[i]
                if (!todo.isDone && todo.state !== 'done' && todo.dueDate.endAt) {
                    if (moment(todo.dueDate.endAt).isAfter(moment())) {
                        reminderQueen.value?.push({
                            index: i,
                            id: todo.id,
                            time: todo.dueDate.endAt
                        })
                    }
                }
            }
            startReminder()
        }
    )

    /** New API Start */

    const mergeFilterInfo = (newOne: Partial<TodoFilter>) => {
        const newFilterInfo = { ...filterInfo.value, ...newOne }
        // console.log(newFilterInfo)
        
        filterInfo.value = newFilterInfo
    }

    const _getData = async (userId: User['id']) => {
        const { page, limit } = pageInfo
        const filterQueryString = parseFilterInfoToQuery()
        const pageQueryString = `page=${page}&limit=${limit}`
        const URI = `/todos?userId=${userId}&${pageQueryString}&${filterQueryString}`
        // console.log(URI)
        const response = await $axios.get(URI)
        return response.data
    }

    const reset = () => {
        todos.value = []
        filterInfo.value = {}
    }

    const init = async (userId: User['id'], filterInfo: Partial<TodoFilter>) => {
        reset()
        mergeFilterInfo(filterInfo)
        return await get(userId)
    }

    const get = async (userId: User['id']) => {
        const response = await _getData(userId)
        if (response.code === '20000') {
            // console.log(response.data)
            const { payload } = response.data
            todos.value = response.data.todos
            countInfo.total = payload.countInfo.total
            countInfo.count = payload.countInfo.count
            countInfo.length = payload.countInfo.length
            countInfo.byState = payload.countInfo.byState
            countInfo.byPriority = payload.countInfo.byPriority
            pageInfo.page = payload.pageInfo.page
            pageInfo.limit = payload.pageInfo.limit
            pageInfo.totalPages = payload.pageInfo.totalPages
        }
        return response
    }

    const find = async (userId: User['id']) => {}

    const toFind = async (userId: User['id'], filterInfo: TodoFilter) => {
        const { page, limit } = pageInfo
        const filterQueryString = parseFilterInfoToQuery(filterInfo)
        const pageQueryString = `page=${page}&limit=${limit}`
        const URI = `/todos?userId=${userId}&${pageQueryString}&${filterQueryString}`
        const response = await $axios.get(URI)
        return response.data
    }

    const toFindOne = async (userId: User['id'], id: Todo['id']) => {
        const { page, limit } = pageInfo
        const filterQueryString = parseFilterInfoToQuery({ id })
        const pageQueryString = `page=${page}&limit=${limit}`
        const URI = `/todo?userId=${userId}&${pageQueryString}&${filterQueryString}`
        const response = await $axios.get(URI)
        return response.data
    }

    const update2 = async (userId: User['id'], id: Todo['id'], updateInfo: Partial<Todo>) => {
        const URI = `/todo?userId=${userId}&id=${id}`
        const todoIdx = todos.value.findIndex((todo) => todo.id === id)
        const todo = todos.value[todoIdx]
        const newTodo = { ...todo, ...updateInfo }
        // console.log(userId, id, updateInfo, newTodo)
        const response = await $axios.put(URI, newTodo)
        if (response.data.code === '20000') {
            // todos.value[todoIdx] = response.data.data
            // console.log(filterInfo.value)
            // await get(userId)
        }
        return response.data
    }

    const create2 = async (userId: User['id'], newTodo: Partial<Todo>) => {
        console.log(userId, newTodo)
        const response = await $axios.post('/todo', newTodo)
        if (response.data.code === '20000') {
            const todo = response.data.data
        }
        return response.data
    }

    const remove2 = async (userId: User['id'], id: Todo['id']) => {}

    /** New API End */

    const startReminder = () => {
        reminderQueen.value?.sort((a, b) => {
            const aDate = new Date(a.time)
            const bDate = new Date(b.time)
            return aDate.getTime() - bDate.getTime()
        })
        if (reminderTimer) {
            clearInterval(reminderTimer)
        }
        reminderTimer = setInterval(() => {
            if (reminderQueen.value?.length) {
                requestIdleCallback(() => {
                    const { index, id, time } = reminderQueen.value[0]
                    if (moment(time).isSameOrBefore(moment())) {
                        reminderQueen.value.shift()
                        console.log(`Reminder Message: ${id} is due`)
                        console.log('Target Todo:', AllTodos.value[index])
                        console.log('Reminder Queen:', reminderQueen.value)
                    }
                })
            }
        }, 10000)
    }

    return {
        todos,
        todo,
        AllTodos,
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
        deleteTodoEvent,
        getTodosByDate,
        getAllTodos,
        getTodosByFilterInfo,
        // New APIs
        mergeFilterInfo,
        reset,
        init,
        get,
        update2,
        toFind,
        toFindOne,
        create2
    }
})
