import { useUserStore, useTodoStore } from '@/stores'
import { NueConfirm, NueMessage, NuePrompt } from 'nue-ui'
import type { Project, Todo, TodoFilter } from '@/stores'

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
    if (!res) return null
    return { ...res } as Todo
}

export const createTodo = async (
    projectId: Project['id'] | null | undefined,
    todoName: Todo['name']
) => {
    const userId = userStore.user!.id
    projectId = projectId || userId
    const res = await todoStore.create(userId, { projectId, name: todoName })
    requestIdleCallback(() => {
        if (res) {
            NueMessage.success('创建成功')
        } else {
            NueMessage.error('创建失败')
        }
    })
    return res
}

export const createTodoWithOptions = async (
    projectId: Project['id'] | null | undefined,
    createOptions: Partial<Todo>
) => {
    const userId = userStore.user!.id
    projectId = projectId || userId
    createOptions = { ...createOptions, projectId }
    const res = await todoStore.create(userId, createOptions)
    // console.log(createOptions)
    requestIdleCallback(() => {
        if (res) {
            NueMessage.success('创建成功')
        } else {
            NueMessage.error('创建失败')
        }
    })
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
    requestIdleCallback(() => {
        if (res) {
            NueMessage.success('更新成功')
        } else {
            NueMessage.error('更新失败')
        }
    })
    return res
}

export const updateTodoWithCompare = async (todoId: Todo['id'], updateInfo: Partial<Todo>) => {
    const { isNeedToUpdate } = todoStore.updatingCompare(todoId, updateInfo)
    if (!isNeedToUpdate) return
    return await updateTodo(todoId, updateInfo)
}

export const updateTodos = async (todoIds: Todo['id'][], updateInfo: Partial<Todo>) => {
    const userId = userStore.user!.id
    const updateResult = await todoStore.updateBatch(userId, todoIds, updateInfo)
    // console.log('[todoHandlers] updateTodos:', updateResult)
    requestIdleCallback(() => {
        if (updateResult === 'Update successful') {
            NueMessage.success('更新成功')
            if (updateInfo.hasOwnProperty('isDeleted')) {
                todoStore.get(userId)
            }
        } else {
            NueMessage.error('更新失败')
        }
    })
    return updateResult === 'Update successful'
}

// Extends

export const removeTodo = async (todoId: Todo['id']) => {
    const userId = userStore.user!.id
    const res = await updateTodo(todoId, { isDeleted: true })
    // console.log('[todoHandlers] removeTodo:', res)
    if (res) {
        await todoStore.get(userId)
        // todoStore.removeLocal(todoId)
    }
    return res
}

export const removeTodoWithConfirm = async (todoId: Todo['id']) => {
    return await NueConfirm({
        title: '删除待办事项',
        content: '确定要删除该待办事项吗？',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        onConfirm: async () => await removeTodo(todoId)
    }).then(
        (res) => res,
        (err) => err
    )
}

export const removeTodosWithConfirm = async (todoIds: Todo['id'][]) => {
    return await NueConfirm({
        title: '批量删除待办事项',
        content: '确定要删除这些待办事项吗？',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        onConfirm: async () => {
            // console.log('[todoHandlers] removeTodosWithConfirm:', todoIds)
            return await updateTodos(todoIds, { isDeleted: true })
        }
    }).then(
        (res) => res,
        (err) => err
    )
}

export const restoreTodo = async (todoId: Todo['id']) => {
    const res = await updateTodo(todoId, { isDeleted: false })
    // console.log('[todoHandlers] restoreTodo:', res)
    if (res) todoStore.removeLocal(todoId)
    return res
}

export const restoreTodoWithConfirm = async (todoId: Todo['id']) => {
    return await NueConfirm({
        title: '恢复待办事项',
        content: '确定要恢复该待办事项吗？',
        confirmButtonText: '恢复',
        cancelButtonText: '取消',
        onConfirm: async () => await restoreTodo(todoId)
    }).then(
        (res) => res,
        (err) => err
    )
}

export const restoreTodosWithConfirm = async (todoIds: Todo['id'][]) => {
    return await NueConfirm({
        title: '批量恢复待办事项',
        content: '确定要恢复这些待办事项吗？',
        confirmButtonText: '恢复',
        cancelButtonText: '取消',
        onConfirm: async () => {
            return await updateTodos(todoIds, { isDeleted: false })
        }
    }).then(
        (res) => res,
        (err) => err
    )
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
