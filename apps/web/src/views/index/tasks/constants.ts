import moment from 'moment'
import { createTodoWithOptions } from '@/handlers/todo-handlers'
import { useUserStore, useProjectStore, useTagStore } from '@/stores'
import type { TodoCreateDialogArgs } from '@nao-todo/components/todo/create-dialog/types'
import type {
    Todo,
    TasksMainBasicViewNames,
    TasksMainViewInfo,
    TodoColumnOptions
} from '@nao-todo/types'

const userStore = useUserStore()
const projectStore = useProjectStore()
const tagStore = useTagStore()

export const defaultColumnOptions: TodoColumnOptions = {
    name: true,
    endAt: true,
    state: true,
    priority: true,
    project: true
}

export const basicViewsInfo: {
    [key in TasksMainBasicViewNames]: TasksMainViewInfo
} = {
    all: {
        id: 'all',
        title: '所有待办',
        description: '所有板块是专门展示和管理工作所有需要完成的任务的地方。',
        preference: {
            viewType: 'table',
            getTodosOptions: { isDeleted: false },
            columns: defaultColumnOptions
        },
        createTodoOptions: {},
        handlers: {
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
        }
    },
    today: {
        id: 'today',
        title: '今日待办',
        description: '今日板块是专门展示和管理工作当天需要完成的任务的地方。',
        preference: {
            viewType: 'table',
            getTodosOptions: {
                isDeleted: false,
                relativeDate: 'today'
            },
            columns: defaultColumnOptions
        },
        createTodoOptions: {},
        handlers: {
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
        }
    },
    tomorrow: {
        id: 'tomorrow',
        title: '明日待办',
        description: '明日板块是专门展示和管理工作明天需要完成的任务的地方。',
        preference: {
            viewType: 'table',
            getTodosOptions: {
                isDeleted: false,
                relativeDate: 'tomorrow'
            },
            columns: defaultColumnOptions
        },
        createTodoOptions: {},
        handlers: {
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
        }
    },
    week: {
        id: 'week',
        title: '本周待办',
        description: '本周板块是专门展示和管理工作本周需要完成的任务的地方。',
        preference: {
            viewType: 'table',
            getTodosOptions: {
                isDeleted: false,
                relativeDate: 'week'
            },
            columns: defaultColumnOptions
        },
        createTodoOptions: {},
        handlers: {
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
        }
    },
    inbox: {
        id: 'inbox',
        title: '收集箱',
        description: '收集箱板块是专门展示和管理工作所有需要完成的任务的地方。',
        preference: {
            viewType: 'table',
            getTodosOptions: {
                isDeleted: false
            },
            columns: defaultColumnOptions
        },
        createTodoOptions: {},
        handlers: {
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
        }
    },
    favorite: {
        id: 'favorite',
        title: '已收藏的待办',
        description: '收藏板块是展示收藏待办的地方。',
        preference: {
            viewType: 'table',
            getTodosOptions: { isFavorited: true },
            columns: defaultColumnOptions
        },
        createTodoOptions: {},
        handlers: {
            handleCreateTodo: async (todoName: Todo['name']) => {
                await createTodoWithOptions(null, { name: todoName, isPinned: true })
            },
            handleCreateTodoByDialog: async (caller: (args: TodoCreateDialogArgs) => void) => {
                caller({
                    userId: userStore.user!.id,
                    projects: projectStore.projects,
                    tags: tagStore.tags,
                    presetInfo: { isPinned: true }
                })
            }
        }
    },
    recycle: {
        id: 'recycle',
        title: '垃圾桶',
        description: '垃圾桶板块是专门展示和管理工作所有已经删除的任务的地方。',
        preference: {
            viewType: 'table',
            getTodosOptions: { isDeleted: true },
            columns: defaultColumnOptions
        },
        createTodoOptions: {}
    }
}
