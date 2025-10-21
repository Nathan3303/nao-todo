import { useMoment } from '@nao-todo/utils'
import type { Todo, TodoColumnOptions } from '@nao-todo/types'
import type { TasksMainViewProps } from '@/layouts/tasks/types'

const basicViewDefaultColumns: TodoColumnOptions = {
    createdAt: true,
    updatedAt: true,
    // deletedAt: false,
    project: true,
    description: true,
    state: true,
    priority: true,
    tags: true,
    startAt: false,
    endAt: true
    // isDeleted: false,
    // isArchived: false,
    // archivedAt: false,
    // isFavorited: false,
    // isGivenUp: false
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

const basicViewProps: TasksMainViewProps[] = [
    {
        id: 'all',
        category: 'basic',
        icon: 'list',
        name: '所有任务',
        description: '',
        preference: {
            viewType: 'table',
            getTodosOptions: { limit: 80 },
            columns: { endAt: true, priority: true, state: true, project: true, tags: true }
        },
        createTodoOptions: {}
    },
    {
        id: 'today',
        category: 'basic',
        icon: 'calendar2',
        name: '今日任务',
        description: '',
        preference: {
            viewType: 'kanban',
            getTodosOptions: { relativeDate: 'today', limit: 20 },
            columns: { endAt: true, priority: true, state: true, project: true, tags: true }
        },
        createTodoOptions: {
            startAt: useMoment().startOf('day').toISOString(true),
            endAt: useMoment().endOf('day').toISOString(true)
        }
    },
    {
        id: 'tomorrow',
        category: 'basic',
        icon: 'tomorrow2',
        name: '明日任务',
        description: '',
        preference: {
            viewType: 'kanban',
            getTodosOptions: { relativeDate: 'tomorrow', limit: 20 },
            columns: { endAt: true, priority: true, state: true, project: true, tags: true }
        },
        createTodoOptions: {
            startAt: useMoment().add(1, 'day').startOf('day').toISOString(true),
            endAt: useMoment().add(1, 'day').endOf('day').toISOString(true)
        }
    },
    {
        id: 'week',
        category: 'basic',
        icon: 'week',
        name: '本周任务',
        description: '',
        preference: {
            viewType: 'table',
            getTodosOptions: { relativeDate: 'week', limit: 80 },
            columns: { endAt: true, priority: true, state: true, project: true, tags: true }
        },
        createTodoOptions: {
            startAt: useMoment().startOf('day').toISOString(true),
            endAt: useMoment().endOf('isoWeek').toISOString(true)
        }
    },
    {
        id: 'inbox',
        category: 'basic',
        icon: 'inbox',
        name: '收集箱',
        description: '',
        preference: {
            viewType: 'table',
            getTodosOptions: { projectId: 'inbox', limit: 80 },
            columns: basicViewDefaultColumns
        },
        createTodoOptions: {}
    },
    {
        id: 'favourite',
        category: 'basic',
        icon: 'heart',
        name: '收藏夹',
        description: '',
        preference: {
            viewType: 'table',
            getTodosOptions: { isFavorited: true, limit: 80 },
            columns: { createdAt: true, endAt: true, project: true, tags: true, description: true }
        },
        createTodoOptions: { isFavorited: true }
    },
    {
        id: 'givenup',
        category: 'basic',
        icon: 'clear',
        name: '已放弃的待办',
        description: '',
        preference: {
            viewType: 'table',
            getTodosOptions: { isGivenUp: true, limit: 80 },
            columns: basicViewDefaultColumns
        },
        createTodoOptions: {}
    },
    {
        id: 'deleted',
        category: 'basic',
        icon: 'delete',
        name: '垃圾桶',
        description: '',
        preference: {
            viewType: 'table',
            getTodosOptions: {
                isDeleted: true,
                sort: { field: 'deletedAt', order: 'desc' },
                limit: 20
            },
            columns: { ...basicViewDefaultColumns, deletedAt: true }
        },
        createTodoOptions: {}
    },
    {
        id: 'overdue',
        category: 'basic',
        icon: 'time',
        name: '已过期的任务',
        description:
            '结束日期于今日零点之前，且未完成的待办任务被视为过期任务，您可以通过延期按钮将待办任务延续至今天。',
        preference: {
            viewType: 'table',
            getTodosOptions: {
                relativeDate: '-today',
                state: 'todo,in-progress',
                sort: { field: 'endAt', order: 'desc' },
                limit: 20
            },
            columns: { ...basicViewDefaultColumns, endAt: true, project: true, description: false }
        },
        createTodoOptions: {}
    }
]

export {
    columnTexts,
    basicViewProps,
    basicViewDefaultColumns,
    basicViewDefaultColumns as defaultColumnOptions
}
