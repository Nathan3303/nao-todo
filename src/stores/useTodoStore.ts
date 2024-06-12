import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { nanoid } from 'nanoid'
import { findOne } from '@/utils/utils'

const LOCAL_STORAGE_KEY = '@todos'

export type TodoStatus = 'todo' | 'in progress' | 'done'
export type TodoProgress = {
    total: number
    finished: number
}
export type Todo = {
    id: string
    projectId: string
    name: string
    description: string
    status: TodoStatus
    progress: TodoProgress
    createdAt: string
    updatedAt: string
    tags: string[]
}
export type CtgrTodos = { [key in TodoStatus]: Todo[] }

export const useTodoStore = defineStore('todoStore', () => {
    const todos = ref<Todo[]>([])
    const selectedTodoId = ref<Todo['id']>()

    function _build(projectId: string, name: string, status: TodoStatus) {
        const timeString = new Date().toString()
        const todo: Todo = {
            id: nanoid(),
            projectId,
            name,
            description: '',
            status,
            progress: { total: 0, finished: 0 },
            createdAt: timeString,
            updatedAt: timeString,
            tags: []
        }
        return todo
    }

    function create(projectId: string, name: string, status: TodoStatus) {
        return new Promise((resolve, reject) => {
            projectId = projectId.trim()
            name = name.trim()
            if (projectId === '') {
                reject('Project id cannot be empty')
            } else if (name === '') {
                reject('Todo name cannot be empty')
            } else {
                const newTodo = _build(projectId, name, status)
                const _todo = findOne(todos.value, (t) => t.name === newTodo.name)
                if (_todo) {
                    reject('Todo already exists')
                } else {
                    todos.value.push(newTodo)
                    resolve(newTodo)
                }
            }
        })
    }

    function check(id: string) {
        return new Promise((resolve, reject) => {
            const todo = findOne(todos.value, (t) => t.id === id)
            if (todo) {
                const index = todos.value.indexOf(todo)
                if (index >= 0) {
                    const currentStatus = todo.status
                    const newStatus = currentStatus === 'done' ? 'todo' : 'done'
                    todos.value[index].status = newStatus
                    resolve(newStatus)
                } else {
                    reject('Todo not found')
                }
            } else {
                reject('Todo not found')
            }
        })
    }

    function remove(id: Todo['id']) {
        return new Promise((resolve, reject) => {
            const _todo = findOne(todos.value, (t) => t.id === id)
            if (_todo) {
                const _idx = todos.value.indexOf(_todo)
                if (_idx >= 0) {
                    todos.value.splice(_idx, 1)
                    resolve(_todo)
                } else {
                    reject('Todo not found')
                }
            } else {
                reject('Todo not found')
            }
        })
    }

    function filter(how: (todo: Todo) => boolean) {
        return todos.value.filter((todo) => how(todo))
    }

    function read() {
        const string = localStorage.getItem(LOCAL_STORAGE_KEY)
        if (string) {
            const _todos = JSON.parse(string)
            todos.value = _todos
        }
        return { filter }
    }

    function commit() {
        const string = JSON.stringify(todos.value)
        localStorage.setItem(LOCAL_STORAGE_KEY, string)
    }

    watch(
        () => todos.value,
        () => commit(),
        { deep: true }
    )

    return {
        todos,
        selectedTodoId,
        create,
        remove,
        filter,
        read,
        check
    }
})
