import { createTodoWithOptions } from '@/utils'
import { useUserStore, useProjectStore, useTagStore } from '@/stores'
import moment from 'moment'
import type { TodoCreateDialogArgs } from '@/components/todo/create-dialog/types'
import type { Todo } from '@/stores'
import type { TasksBasicViewHandlers } from './types'

const userStore = useUserStore()
const projectStore = useProjectStore()
const tagStore = useTagStore()

export const handlers: TasksBasicViewHandlers = {
    all: {
        handleCreateTodo: async (todoName: Todo['name']) => {
            await createTodoWithOptions(null, { name: todoName })
        },
        handleCreateTodoByDialog: async (caller: (args: TodoCreateDialogArgs) => void) => {
            caller({
                userId: userStore.user!.id,
                projects: projectStore.projects,
                tags: tagStore.tags
            })
        }
    },
    today: {
        handleCreateTodo: async (todoName: Todo['name']) => {
            const now = moment()
            await createTodoWithOptions(null, {
                name: todoName,
                dueDate: {
                    startAt: now.toISOString(),
                    endAt: now.endOf('day').toISOString()
                }
            })
        },
        handleCreateTodoByDialog: async (caller: (args: TodoCreateDialogArgs) => void) => {
            const now = moment()
            caller({
                userId: userStore.user!.id,
                projects: projectStore.projects,
                tags: tagStore.tags,
                presetInfo: {
                    dueDate: {
                        startAt: now.toISOString(),
                        endAt: now.endOf('day').toISOString(true)
                    }
                }
            })
        }
    },
    tomorrow: {
        handleCreateTodo: async (todoName: Todo['name']) => {
            const tomorrow = moment().add(1, 'day')
            await createTodoWithOptions(null, {
                name: todoName,
                dueDate: {
                    startAt: tomorrow.toISOString(),
                    endAt: tomorrow.endOf('day').toISOString()
                }
            })
        },
        handleCreateTodoByDialog: async (caller: (args: TodoCreateDialogArgs) => void) => {
            const tomorrow = moment().add(1, 'day')
            caller({
                userId: userStore.user!.id,
                projects: projectStore.projects,
                tags: tagStore.tags,
                presetInfo: {
                    dueDate: {
                        startAt: tomorrow.toISOString(),
                        endAt: tomorrow.endOf('day').toISOString(true)
                    }
                }
            })
        }
    },
    week: {
        handleCreateTodo: async (todoName: Todo['name']) => {
            const now = moment()
            await createTodoWithOptions(null, {
                name: todoName,
                dueDate: {
                    startAt: now.toISOString(),
                    endAt: now.add(7, 'd').endOf('d').toISOString(true)
                }
            })
        },
        handleCreateTodoByDialog: async (caller: (args: TodoCreateDialogArgs) => void) => {
            const now = moment()
            caller({
                userId: userStore.user!.id,
                projects: projectStore.projects,
                tags: tagStore.tags,
                presetInfo: {
                    dueDate: {
                        startAt: now.toISOString(),
                        endAt: now.add(7, 'd').endOf('d').toISOString(true)
                    }
                }
            })
        }
    },
    inbox: {
        handleCreateTodo: async (todoName: Todo['name']) => {
            await createTodoWithOptions(null, { name: todoName })
        },
        handleCreateTodoByDialog: async (caller: (args: TodoCreateDialogArgs) => void) => {
            caller({
                userId: userStore.user!.id,
                projects: projectStore.projects,
                tags: tagStore.tags
            })
        }
    },
    recycle: {
        handleCreateTodo: async (todoName: Todo['name']) => {},
        handleCreateTodoByDialog: async (caller: (args: TodoCreateDialogArgs) => void) => {}
    }
}
