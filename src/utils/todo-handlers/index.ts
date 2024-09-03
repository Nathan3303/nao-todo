import { useUserStore, useTodoStore } from '@/stores'
import { NueConfirm, NueMessage, NuePrompt } from 'nue-ui'
import type { Project, Tag, Todo, TodoFilter } from '@/stores'

const userStore = useUserStore()
const todoStore = useTodoStore()

// Standards

export const getTodos = async (filterOptions: TodoFilter) => {
    const userId = userStore.user!.id
    await todoStore.initialize(userId, filterOptions)
}

export const getTodo = async (todoId: Todo['id']) => {
    const userId = userStore.user!.id
    const res = await todoStore.toFindedOne(userId, todoId)
    // console.log('[todoHandlers] getTodo:', res)
    return res as Todo | null
}

export const createTodo = async (
    projectId: Project['id'] | null | undefined,
    todoName: Todo['name']
) => {
    const userId = userStore.user!.id
    projectId = projectId || userId
    const res = await todoStore.create(userId, { projectId, name: todoName })
    if (res) {
        NueMessage.success('创建成功')
    } else {
        NueMessage.error('创建失败')
    }
    return res
}

export const createTodoWithOptions = async (
    projectId: Project['id'] | null | undefined,
    createOptions: Partial<Todo>
) => {
    const userId = userStore.user!.id
    projectId = projectId || userId
    createOptions = { projectId, ...createOptions }
    const res = await todoStore.create(userId, createOptions)
    // console.log(createOptions)
    if (res) {
        NueMessage.success('创建成功')
    } else {
        NueMessage.error('创建失败')
    }
    return res
}

export const createTodoWithPrompt = async (projectId: Project['id']) => {
    NuePrompt({
        title: '创建待办事项',
        placeholder: '请输入待办事项名称',
        confirmButtonText: '创建',
        cancelButtonText: '取消',
        validator: (value: string) => value
    }).then(async (todoName) => {
        todoName = (todoName as string).trim()
        if (!todoName) return
        await createTodo(projectId, todoName as Todo['name'])
    })
}

export const updateTodo = async (todoId: Todo['id'], updateInfo: Partial<Todo>) => {
    const userId = userStore.user!.id
    const res = await todoStore.update(userId, todoId, updateInfo)
    // console.log('[todoHandlers] updateTodo:', res)
    if (res) {
        NueMessage.success('更新成功')
    } else {
        NueMessage.error('更新失败')
    }
    return res
}

// Extends

export const removeTodo = async (todoId: Todo['id']) => {
    const res = await updateTodo(todoId, { isDeleted: true })
    // console.log('[todoHandlers] removeTodo:', res)
    if (res) todoStore.removeLocal(todoId)
}

export const removeTodoWithConfirm = async (todoId: Todo['id']) => {
    NueConfirm({
        title: '删除待办事项',
        content: '确定要删除该待办事项吗？',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
    }).then(async () => {
        // console.log('[todoHandlers] removeTodoWithConfirm:', todoId)
        await removeTodo(todoId)
    })
}

export const restoreTodo = async (todoId: Todo['id']) => {
    const res = await updateTodo(todoId, { isDeleted: false })
    // console.log('[todoHandlers] restoreTodo:', res)
    if (res) todoStore.removeLocal(todoId)
}

export const restoreTodoWithConfirm = async (todoId: Todo['id']) => {
    NueConfirm({
        title: '恢复待办事项',
        content: '确定要恢复该待办事项吗？',
        confirmButtonText: '恢复',
        cancelButtonText: '取消'
    }).then(async () => {
        // console.log('[todoHandlers] restoreTodoWithConfirm:', todoId)
        await restoreTodo(todoId)
    })
}

export const finishTodo = async (todoId: Todo['id']) => {
    await updateTodo(todoId, { isDone: true })
}

export const unfinishTodo = async (todoId: Todo['id']) => {
    await updateTodo(todoId, { isDone: false })
}

export const setTodoDueDate = async (todoId: Todo['id'], dueDate: Todo['dueDate']) => {
    await updateTodo(todoId, { dueDate })
}

export const moveTodo = async (todoId: Todo['id'], newProjectId: Todo['projectId']) => {
    await updateTodo(todoId, { projectId: newProjectId })
}

export const updateTodoTags = async (todoId: Todo['id'], newTags: Todo['tags']) => {
    await updateTodo(todoId, { tags: newTags })
}
