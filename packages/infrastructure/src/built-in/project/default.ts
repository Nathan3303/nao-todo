import { defaultColumns } from '@nao-todo/shared/constants/task'
import dayjs from 'dayjs'
import type { BuiltInProjectPreferenceRes, BuiltInProjectRes } from './types'

export const defaultBuiltInProjects: BuiltInProjectRes[] = [
    {
        id: 'all',
        icon: 'more2',
        name: '所有任务',
        nameKey: 'builtin.all',
        description: '',
        createTaskOptions: {}
    },
    {
        id: 'today',
        icon: 'calendar2',
        name: '今日任务',
        nameKey: 'builtin.today',
        description: '',
        createTaskOptions: () => ({
            startAt: dayjs().startOf('day').toISOString(),
            endAt: dayjs().endOf('day').toISOString()
        })
    },
    {
        id: 'tomorrow',
        icon: 'tomorrow',
        name: '明日任务',
        nameKey: 'builtin.tomorrow',
        description: '',
        createTaskOptions: () => ({
            startAt: dayjs().add(1, 'day').startOf('day').toISOString(),
            endAt: dayjs().add(1, 'day').endOf('day').toISOString()
        })
    },
    {
        id: 'week',
        icon: 'week',
        name: '本周任务',
        nameKey: 'builtin.week',
        description: '',
        createTaskOptions: () => ({
            startAt: dayjs().startOf('day').toISOString(),
            endAt: dayjs().endOf('week').toISOString()
        })
    },
    {
        id: 'inbox',
        icon: 'inbox2-fill',
        name: '收集箱',
        nameKey: 'builtin.inbox',
        description: '',
        createTaskOptions: { projectId: void 0 }
    },
    {
        id: 'favourite',
        icon: 'heart-fill',
        name: '收藏夹',
        nameKey: 'builtin.favourite',
        description: '',
        createTaskOptions: { isStarMarked: true }
    },
    {
        id: 'deleted',
        icon: 'recycle-bin',
        name: '垃圾桶',
        nameKey: 'builtin.deleted',
        description: '',
        createTaskOptions: {}
    },
    {
        id: 'overdue',
        icon: 'time',
        name: '已过期的任务',
        nameKey: 'builtin.overdue',
        description:
            '结束日期于今日零点之前，且未完成的待办任务被视为过期任务，您可以通过延期按钮将待办任务延续至今天。',
        createTaskOptions: {}
    },
    {
        id: 'givenup',
        icon: 'clear',
        name: '已放弃的待办',
        nameKey: 'builtin.givenup',
        description: '',
        createTaskOptions: {}
    }
]

export const defaultBuiltInProjectPreferences: BuiltInProjectPreferenceRes[] = [
    {
        projectId: 'all',
        userId: 'default',
        viewType: 'table',
        getTasksOptions: JSON.stringify({
            limit: 20,
            isGivenUp: false
        }),
        columns: JSON.stringify({ ...defaultColumns, description: false })
    },
    {
        projectId: 'today',
        userId: 'default',
        viewType: 'list',
        getTasksOptions: JSON.stringify({
            relativeDate: 'today',
            limit: 20,
            isGivenUp: false
        }),
        columns: JSON.stringify(defaultColumns)
    },
    {
        projectId: 'tomorrow',
        userId: 'default',
        viewType: 'list',
        getTasksOptions: JSON.stringify({
            relativeDate: 'tomorrow',
            limit: 20,
            isGivenUp: false
        }),
        columns: JSON.stringify(defaultColumns)
    },
    {
        projectId: 'week',
        userId: 'default',
        viewType: 'table',
        getTasksOptions: JSON.stringify({
            relativeDate: 'week',
            limit: 20,
            isGivenUp: false
        }),
        columns: JSON.stringify(defaultColumns)
    },
    {
        projectId: 'inbox',
        userId: 'default',
        viewType: 'table',
        getTasksOptions: JSON.stringify({
            projectId: 'inbox',
            limit: 20,
            isGivenUp: false
        }),
        columns: JSON.stringify(defaultColumns)
    },
    {
        projectId: 'favourite',
        userId: 'default',
        viewType: 'table',
        getTasksOptions: JSON.stringify({
            isStarMarked: true,
            limit: 20,
            isGivenUp: false
        }),
        columns: JSON.stringify({ ...defaultColumns, starMarkAt: true, description: false })
    },
    {
        projectId: 'givenup',
        userId: 'default',
        viewType: 'table',
        getTasksOptions: JSON.stringify({
            isGivenUp: true,
            limit: 20,
            isDeleted: false
        }),
        columns: JSON.stringify({
            ...defaultColumns,
            givenUpAt: true,
            description: false,
            updatedAt: false,
            endAt: false
        })
    },
    {
        projectId: 'deleted',
        userId: 'default',
        viewType: 'table',
        getTasksOptions: JSON.stringify({
            isDeleted: true,
            sort: { field: 'deletedAt', order: 'desc' },
            limit: 20,
            isGivenUp: false
        }),
        columns: JSON.stringify({
            ...defaultColumns,
            deletedAt: true,
            description: false,
            updatedAt: false,
            endAt: false
        })
    },
    {
        projectId: 'overdue',
        userId: 'default',
        viewType: 'table',
        getTasksOptions: JSON.stringify({
            relativeDate: '-today',
            state: 'todo,in-progress',
            sort: { field: 'endAt', order: 'desc' },
            limit: 20,
            isGivenUp: false,
            isDeleted: false
        }),
        columns: JSON.stringify({
            ...defaultColumns,
            endAt: true,
            description: false,
            updatedAt: false
        })
    }
]