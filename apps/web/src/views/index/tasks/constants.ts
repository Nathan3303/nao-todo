import moment from 'moment'
import { useProjectStore, useTagStore, useTodoStore, useUserStore } from '@/stores'
import type { CreateTodoDialogCallerArgs } from '@/layers/create-todo-dialog/types'
import type {
    ProjectPreference,
    TasksMainBasicViewNames,
    TasksMainViewInfo,
    Todo,
    TodoColumnOptions
} from '@nao-todo/types'

const userStore = useUserStore()
const projectStore = useProjectStore()
const tagStore = useTagStore()
const todoStore = useTodoStore()

export const defaultColumnOptions: TodoColumnOptions = {
    endAt: true,
    state: true,
    priority: true,
    project: true,
    createdAt: false,
    updatedAt: false
}

export const defaultPreference: ProjectPreference = {
    viewType: 'table',
    getTodosOptions: { page: 1, limit: 20, isDeleted: false },
    columns: defaultColumnOptions
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
        createTodoOptions: { dueDate: {} },
        handlers: {
            handleCreateTodo: async (todoName: Todo['name']) => {
                await todoStore.doCreateTodo({ dueDate: {}, name: todoName })
            },
            handleCreateTodoByDialog: async (caller: (args: CreateTodoDialogCallerArgs) => void) => {
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
        createTodoOptions: {
            dueDate: {
                startAt: moment().startOf('day').toISOString(true),
                endAt: moment().endOf('day').toISOString(true)
            }
        },
        handlers: {
            handleCreateTodo: async (todoName: Todo['name']) => {
                const now = moment()
                await todoStore.doCreateTodo({
                    name: todoName,
                    dueDate: {
                        startAt: now.toISOString(),
                        endAt: now.endOf('day').toISOString()
                    }
                })
            },
            handleCreateTodoByDialog: async (caller: (args: CreateTodoDialogCallerArgs) => void) => {
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
        createTodoOptions: {
            dueDate: {
                startAt: moment().add(1, 'day').startOf('day').toISOString(true),
                endAt: moment().add(1, 'day').endOf('day').toISOString(true)
            }
        },
        handlers: {
            handleCreateTodo: async (todoName: Todo['name']) => {
                const tomorrow = moment().add(1, 'day')
                await todoStore.doCreateTodo({
                    name: todoName,
                    dueDate: {
                        startAt: tomorrow.toISOString(),
                        endAt: tomorrow.endOf('day').toISOString()
                    }
                })
            },
            handleCreateTodoByDialog: async (caller: (args: CreateTodoDialogCallerArgs) => void) => {
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
        createTodoOptions: {
            dueDate: {
                startAt: moment().startOf('day').toISOString(true),
                endAt: moment().endOf('isoWeek').toISOString(true)
            }
        },
        handlers: {
            handleCreateTodo: async (todoName: Todo['name']) => {
                const now = moment()
                await todoStore.doCreateTodo({
                    name: todoName,
                    dueDate: {
                        startAt: now.toISOString(),
                        endAt: now.add(7, 'd').endOf('d').toISOString(true)
                    }
                })
            },
            handleCreateTodoByDialog: async (caller: (args: CreateTodoDialogCallerArgs) => void) => {
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
        createTodoOptions: { dueDate: {} },
        handlers: {
            handleCreateTodo: async (todoName: Todo['name']) => {
                await todoStore.doCreateTodo({ dueDate: {}, name: todoName })
            },
            handleCreateTodoByDialog: async (caller: (args: CreateTodoDialogCallerArgs) => void) => {
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
        createTodoOptions: {
            dueDate: {},
            isFavorited: true
        },
        handlers: {
            handleCreateTodo: async (todoName: Todo['name']) => {
                await todoStore.doCreateTodo({ dueDate: {}, name: todoName, isFavorited: true })
            },
            handleCreateTodoByDialog: async (caller: (args: CreateTodoDialogCallerArgs) => void) => {
                caller({
                    userId: userStore.user!.id,
                    projects: projectStore.projects,
                    tags: tagStore.tags,
                    presetInfo: { isFavorited: true }
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
        createTodoOptions: { dueDate: {} }
    }
}
