import { useUserStore, useProjectStore, useTodoStore } from '@/stores'
import { NueConfirm, NueMessage, NuePrompt } from 'nue-ui'
import type { Project, Todo, TodoFilter } from '@/stores'

const userStore = useUserStore()
const todoStore = useTodoStore()

export const getTodos = async (filterOptions: TodoFilter) => {
    const userId = userStore.user!.id
    await todoStore.initialize(userId, filterOptions)
}

export const getTodo = async (todoId: Todo['id']) => {
    const userId = userStore.user!.id
    const res = await todoStore.toFindedOne(userId, todoId)
    console.log('[todoHandlers] getTodo:', res)
    return res as Todo | null
}

export const createTodo = async (projectId: Project['id'], todoName: Todo['name']) => {
    const userId = userStore.user!.id
    const res = await todoStore.create(userId, { projectId, name: todoName })
    console.log('[createTodo] createTodo:', res)
}

export const createTodoWithPrompt = async (projectId: Project['id']) => {
    const todoName = await NuePrompt({
        title: '创建待办事项',
        placeholder: '请输入待办事项名称',
        confirmButtonText: '创建',
        cancelButtonText: '取消',
        validator: (value: string) => value
    })
}

export const updateTodo = async (todoId: Todo['id'], updateInfo: Partial<Todo>) => {
    const userId = userStore.user!.id
    const res = await todoStore.update(userId, todoId, updateInfo)
    console.log('[todoHandlers] updateTodo:', res)
}

export const removeTodo = async (todoId: Todo['id']) => {
    const res = await updateTodo(todoId, { isDeleted: true })
    console.log('[todoHandlers] removeTodo:', res)
}

export const restoreTodo = async (todoId: Todo['id']) => {
    const res = await updateTodo(todoId, { isDeleted: false })
    console.log('[todoHandlers] restoreTodo:', res)
}

export const removeTodoWithConfirm = async (todoId: Todo['id']) => {
    const res = await NueConfirm({
        title: '删除待办事项',
        message: '确定要删除该待办事项吗？',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
    })
    if (res) {
        await removeTodo(todoId)
    }
}

export const restoreTodoWithConfirm = async (todoId: Todo['id']) => {
    const res = await NueConfirm({
        title: '恢复待办事项',
        message: '确定要恢复该待办事项吗？',
        confirmButtonText: '恢复',
        cancelButtonText: '取消'
    })
    if (res) {
        await restoreTodo(todoId)
    }
}

export const removeTodoPermanently = async (todoId: Todo['id']) => {
    // TODO: remove todo permanently
}
