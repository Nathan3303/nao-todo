import type {
    GetProjectsOptions,
    ProjectPreference,
    TasksMainBasicViewNames,
    TasksMainViewInfo,
    TodoColumnOptions
} from '@nao-todo/types'
import moment from 'moment/moment'

export const TasksViewCtxKey = 'TASKS_VIEW_CTX_KEY'

export const todoStoreDefaults = {
    getOptions: {
        page: 1,
        limit: 20
    },
    getOverview: {
        countInfo: {
            byPriority: {},
            byState: {},
            total: 0,
            length: 0,
            count: 0
        },
        pageInfo: {
            page: 1,
            totalPages: 1
        }
    },
    columnOptions: {
        state: true,
        priority: true,
        project: true,
        endAt: true,
        description: true,
        createdAt: false,
        updatedAt: false
    }
}

export const projectStoreDefaults: { getOptions: GetProjectsOptions } = {
    getOptions: {
        page: 1,
        limit: 99,
        sort: {
            field: 'createdAt',
            order: 'desc'
        }
    }
}

export const tagStoreDefaults = {
    getOptions: {
        page: 1,
        limit: 99
    }
}

// 默认列选项
export const defaultColumnOptions: TodoColumnOptions = {
    endAt: true,
    state: true,
    priority: true,
    project: true,
    description: false,
    createdAt: false,
    updatedAt: false
}

// 默认偏好
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
        handlers: {}
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
        handlers: {}
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
        handlers: {}
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
        handlers: {}
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
        handlers: {}
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
        handlers: {}
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

export const TodoStateOptions = [
    { label: '待办', value: 'todo' },
    { label: '进行中', value: 'in-progress' },
    { label: '已完成', value: 'done' }
]

export const TodoPriorityOptions = [
    { label: '高优先级', value: 'high' },
    { label: '中优先级', value: 'medium' },
    { label: '低优先级', value: 'low' }
]
