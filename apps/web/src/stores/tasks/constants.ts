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
            getTodosOptions: {},
            columns: basicViewDefaultColumns
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
            viewType: 'table',
            getTodosOptions: { relativeDate: 'today' },
            columns: basicViewDefaultColumns
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
            viewType: 'table',
            getTodosOptions: { relativeDate: 'tomorrow' },
            columns: basicViewDefaultColumns
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
            getTodosOptions: { relativeDate: 'week' },
            columns: basicViewDefaultColumns
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
            getTodosOptions: { projectId: 'inbox' },
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
            getTodosOptions: { isFavorited: true },
            columns: basicViewDefaultColumns
        },
        createTodoOptions: { isFavorited: true }
    },
    {
        id: 'givenup',
        category: 'basic',
        icon: 'clear',
        name: '已放弃的待办',
        description:
            '下方视图所罗列出来的是被您放弃的待办任务，您可以通过点击任务名称进入任务详情页面以恢复该任务。',
        preference: {
            viewType: 'table',
            getTodosOptions: { isGivenUp: true },
            columns: basicViewDefaultColumns
        },
        createTodoOptions: {}
    },
    {
        id: 'deleted',
        category: 'basic',
        icon: 'delete',
        name: '垃圾桶',
        description:
            '下方视图所罗列出来的是被您删除的待办任务，您可以通过点击任务名称进入任务详情页面以恢复该任务。需要注意的是垃圾桶中的任务将会在 30 天后彻底删除。',
        preference: {
            viewType: 'table',
            getTodosOptions: { isDeleted: true },
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
            '下方视图所罗列出来的是您已过期的任务（结束日期小于今日零点且未完成），您可以通过延期按钮将任务延续至今天。',
        preference: {
            viewType: 'table',
            getTodosOptions: {
                relativeDate: '-today',
                state: 'todo,in-progress',
                sort: { field: 'endAt', order: 'desc' }
            },
            columns: { ...basicViewDefaultColumns, endAt: true, project: true }
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
