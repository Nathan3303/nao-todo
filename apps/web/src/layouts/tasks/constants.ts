import { useMoment } from '@nao-todo/utils'
import type { Todo, TodoColumnOptions } from '@nao-todo/types'
import type { TasksMainViewProps } from '@/layouts/tasks/types'

const defaultColumnOptions: TodoColumnOptions = {
    createdAt: false,
    updatedAt: false,
    deletedAt: false,
    project: false,
    description: true,
    state: true,
    priority: true,
    tags: true,
    startAt: false,
    endAt: true,
    isDeleted: false,
    isArchived: false,
    archivedAt: false,
    isFavorited: false,
    isGivenUp: false
}

const columnTexts: { [key in keyof Todo]: string } = {
    id: 'ID',
    createdAt: '创建时间',
    updatedAt: '更新时间',
    deletedAt: '删除时间',
    userId: '所属用户 ID',
    projectId: '所属清单 ID',
    name: '名称',
    description: '描述',
    state: '状态',
    priority: '优先级',
    startAt: '起始日期',
    endAt: '截止日期',
    project: '所属清单',
    tags: '标签',
    archivedAt: '归档时间',
    isDeleted: '是否删除',
    isArchived: '是否归档',
    isFavorited: '是否收藏',
    isGivenUp: '是否放弃'
}

const viewPropsForAll: TasksMainViewProps = {
    id: 'all',
    category: 'basic',
    icon: 'list',
    name: '所有任务',
    description: '',
    preference: {
        viewType: 'table',
        getTodosOptions: {
            isDeleted: false,
            isGivenUp: false,
            sort: { field: 'createdAt', order: 'desc' }
        },
        columns: { ...defaultColumnOptions }
    },
    createTodoOptions: {}
}

const viewPropsForToday: TasksMainViewProps = {
    id: 'today',
    category: 'basic',
    icon: 'calendar2',
    name: '今日任务',
    description: '',
    preference: {
        viewType: 'table',
        getTodosOptions: {
            isDeleted: false,
            relativeDate: 'today',
            isGivenUp: false,
            sort: { field: 'createdAt', order: 'desc' }
        },
        columns: { ...defaultColumnOptions }
    },
    createTodoOptions: {
        startAt: useMoment().startOf('day').toISOString(true),
        endAt: useMoment().endOf('day').toISOString(true)
    }
}

const viewPropsForTomorrow: TasksMainViewProps = {
    id: 'tomorrow',
    category: 'basic',
    icon: 'tomorrow2',
    name: '明日任务',
    description: '',
    preference: {
        viewType: 'table',
        getTodosOptions: {
            isDeleted: false,
            relativeDate: 'tomorrow',
            isGivenUp: false,
            sort: { field: 'createdAt', order: 'desc' }
        },
        columns: { ...defaultColumnOptions }
    },
    createTodoOptions: {
        startAt: useMoment().add(1, 'day').startOf('day').toISOString(true),
        endAt: useMoment().add(1, 'day').endOf('day').toISOString(true)
    }
}

const viewPropsForWeek: TasksMainViewProps = {
    id: 'week',
    category: 'basic',
    icon: 'week',
    name: '本周任务',
    description: '',
    preference: {
        viewType: 'table',
        getTodosOptions: {
            isDeleted: false,
            relativeDate: 'week',
            isGivenUp: false,
            sort: { field: 'createdAt', order: 'desc' }
        },
        columns: { ...defaultColumnOptions }
    },
    createTodoOptions: {
        startAt: useMoment().startOf('day').toISOString(true),
        endAt: useMoment().endOf('isoWeek').toISOString(true)
    }
}

const viewPropsForInbox: TasksMainViewProps = {
    id: 'inbox',
    category: 'basic',
    icon: 'inbox',
    name: '收集箱',
    description: '',
    preference: {
        viewType: 'table',
        getTodosOptions: {
            isDeleted: false,
            isGivenUp: false,
            sort: { field: 'createdAt', order: 'desc' }
        },
        columns: { ...defaultColumnOptions }
    },
    createTodoOptions: {}
}

const viewPropsForFavorite: TasksMainViewProps = {
    id: 'favorite',
    category: 'basic',
    icon: 'heart',
    name: '收藏夹',
    description: '',
    preference: {
        viewType: 'table',
        getTodosOptions: { isFavorited: true, sort: { field: 'createdAt', order: 'desc' } },
        columns: { ...defaultColumnOptions }
    },
    createTodoOptions: { isFavorited: true }
}

const viewPropsForGivenUp: TasksMainViewProps = {
    id: 'givenup',
    category: 'basic',
    icon: 'clear',
    name: '已放弃的待办',
    description: '',
    preference: {
        viewType: 'table',
        getTodosOptions: {
            isGivenUp: true,
            isDeleted: false,
            sort: { field: 'createdAt', order: 'desc' }
        },
        columns: { ...defaultColumnOptions }
    },
    createTodoOptions: {}
}

const viewPropsForRecycle: TasksMainViewProps = {
    id: 'recycle',
    category: 'basic',
    icon: 'delete',
    name: '垃圾桶',
    description: '',
    preference: {
        viewType: 'table',
        getTodosOptions: { isDeleted: true, sort: { field: 'createdAt', order: 'desc' } },
        columns: { ...defaultColumnOptions }
    },
    createTodoOptions: {}
}

const basicViewProps: TasksMainViewProps[] = [
    viewPropsForAll,
    viewPropsForToday,
    viewPropsForTomorrow,
    viewPropsForWeek,
    viewPropsForInbox,
    viewPropsForFavorite,
    viewPropsForGivenUp,
    viewPropsForRecycle
]

export { defaultColumnOptions, basicViewProps, columnTexts }
