import { useMoment } from '@nao-todo/utils'
import { useProjectStore, useTagStore, useTodoStore, useUserStore } from '@/stores'
import type {
    ProjectPreference,
    TasksMainBasicViewNames,
    TasksMainViewInfo,
    Todo,
    TodoColumnOptions
} from '@nao-todo/types'
import type { TodoCreatorProps } from '@nao-todo/components/todo/creator/types'

const userStore = useUserStore()
const projectStore = useProjectStore()
const tagStore = useTagStore()
const todoStore = useTodoStore()

// 默认列选项
export const defaultColumnOptions: TodoColumnOptions = {
    name: true,
    endAt: true,
    state: true,
    priority: true,
    project: true,
    description: false,
    createdAt: false,
    updatedAt: false
}

// 列选项中文

export const columnOptionsInfoMap = {
    endAt: '截止日期',
    state: '状态',
    priority: '优先级',
    project: '所属清单',
    description: '描述',
    createdAt: '创建时间',
    updatedAt: '更新时间',
    name: '名称',
    tags: '标签'
}

// 默认偏好
export const defaultPreference: ProjectPreference = {
    viewType: 'table',
    getTodosOptions: { page: 1, limit: 20, isDeleted: false, isGivenUp: false },
    columns: defaultColumnOptions
}

// 基础视图信息预设
export const basicViewsInfo: {
    [key in TasksMainBasicViewNames]: TasksMainViewInfo
} = {
    all: {
        id: 'all',
        title: '所有待办',
        description: '所有板块是专门展示和管理工作所有需要完成的任务的地方。',
        preference: {
            viewType: 'table',
            getTodosOptions: { isDeleted: false, isGivenUp: false },
            columns: defaultColumnOptions
        },
        createTodoOptions: { dueDate: {} },
        handlers: {
            handleCreateTodo: async (todoName: Todo['name']) => {
                await todoStore.doCreateTodo({ dueDate: {}, name: todoName })
            },
            handleCreateTodoByDialog: async (caller: (args: TodoCreatorProps) => void) => {
                caller({
                    userId: userStore.user?.id || '',
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
                relativeDate: 'today',
                isGivenUp: false
            },
            columns: defaultColumnOptions
        },
        createTodoOptions: {
            dueDate: {
                startAt: useMoment().startOf('day').toISOString(true),
                endAt: useMoment().endOf('day').toISOString(true)
            }
        },
        handlers: {
            handleCreateTodo: async (todoName: Todo['name']) => {
                const now = useMoment()
                await todoStore.doCreateTodo({
                    name: todoName,
                    dueDate: {
                        startAt: now.toISOString(),
                        endAt: now.endOf('day').toISOString()
                    }
                })
            },
            handleCreateTodoByDialog: async (caller: (args: TodoCreatorProps) => void) => {
                const now = useMoment()
                caller({
                    userId: userStore.user?.id || '',
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
                relativeDate: 'tomorrow',
                isGivenUp: false
            },
            columns: defaultColumnOptions
        },
        createTodoOptions: {
            dueDate: {
                startAt: useMoment().add(1, 'day').startOf('day').toISOString(true),
                endAt: useMoment().add(1, 'day').endOf('day').toISOString(true)
            }
        },
        handlers: {
            handleCreateTodo: async (todoName: Todo['name']) => {
                const tomorrow = useMoment().add(1, 'day')
                await todoStore.doCreateTodo({
                    name: todoName,
                    dueDate: {
                        startAt: tomorrow.toISOString(),
                        endAt: tomorrow.endOf('day').toISOString()
                    }
                })
            },
            handleCreateTodoByDialog: async (caller: (args: TodoCreatorProps) => void) => {
                const tomorrow = useMoment().add(1, 'day')
                caller({
                    userId: userStore.user?.id || '',
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
                relativeDate: 'week',
                isGivenUp: false
            },
            columns: defaultColumnOptions
        },
        createTodoOptions: {
            dueDate: {
                startAt: useMoment().startOf('day').toISOString(true),
                endAt: useMoment().endOf('isoWeek').toISOString(true)
            }
        },
        handlers: {
            handleCreateTodo: async (todoName: Todo['name']) => {
                const now = useMoment()
                await todoStore.doCreateTodo({
                    name: todoName,
                    dueDate: {
                        startAt: now.toISOString(),
                        endAt: now.add(7, 'd').endOf('d').toISOString(true)
                    }
                })
            },
            handleCreateTodoByDialog: async (caller: (args: TodoCreatorProps) => void) => {
                const now = useMoment()
                caller({
                    userId: userStore.user?.id || '',
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
                isDeleted: false,
                isGivenUp: false
            },
            columns: defaultColumnOptions
        },
        createTodoOptions: { dueDate: {} },
        handlers: {
            handleCreateTodo: async (todoName: Todo['name']) => {
                await todoStore.doCreateTodo({ dueDate: {}, name: todoName })
            },
            handleCreateTodoByDialog: async (caller: (args: TodoCreatorProps) => void) => {
                caller({
                    userId: userStore.user?.id || '',
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
                await todoStore.doCreateTodo({
                    dueDate: {},
                    name: todoName,
                    isFavorited: true
                })
            },
            handleCreateTodoByDialog: async (caller: (args: TodoCreatorProps) => void) => {
                caller({
                    userId: userStore.user?.id || '',
                    projects: projectStore.projects,
                    tags: tagStore.tags,
                    presetInfo: { isFavorited: true }
                })
            }
        }
    },
    giveup: {
        id: 'giveup',
        title: '已放弃的待办',
        description: '下方是已放弃的待办。',
        preference: {
            viewType: 'table',
            getTodosOptions: { isGivenUp: true, isDeleted: false },
            columns: defaultColumnOptions
        },
        createTodoOptions: {
            dueDate: {}
        },
        handlers: {
            handleCreateTodo: async (todoName: Todo['name']) => {
                await todoStore.doCreateTodo({
                    dueDate: {},
                    name: todoName
                })
            },
            handleCreateTodoByDialog: async (caller: (args: TodoCreatorProps) => void) => {
                caller({
                    userId: userStore.user?.id || '',
                    projects: projectStore.projects,
                    tags: tagStore.tags,
                    presetInfo: {}
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
