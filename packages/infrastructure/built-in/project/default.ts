import dayjs from 'dayjs'
import type { BuiltInProject, BuiltInProjectPreference } from './types'

export const defaultBuiltInProjects: BuiltInProject[] = [
    {
        id: 'all',
        icon: 'more2',
        name: '所有任务',
        description: '',
        createTaskOptions: {}
    },
    {
        id: 'today',
        icon: 'calendar2',
        name: '今日任务',
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
        description: '',
        createTaskOptions: {}
    },
    {
        id: 'favourite',
        icon: 'heart-fill',
        name: '收藏夹',
        description: '',
        createTaskOptions: {}
    },
    {
        id: 'givenup',
        icon: 'clear',
        name: '已放弃的待办',
        description: '',
        createTaskOptions: {}
    },
    {
        id: 'deleted',
        icon: 'recycle-bin',
        name: '垃圾桶',
        description: '',
        createTaskOptions: {}
    },
    {
        id: 'overdue',
        icon: 'time',
        name: '已过期的任务',
        description:
            '结束日期于今日零点之前，且未完成的待办任务被视为过期任务，您可以通过延期按钮将待办任务延续至今天。',
        createTaskOptions: {}
    }
]

export const defaultBuiltInProjectPreferences: BuiltInProjectPreference[] = [
    {
        projectId: 'all',
        userId: 'default',
        viewType: 'table',
        getTasksOptions: '{"limit": 80}',
        columns:
            '{ "endAt": true, "priority": true, "state": true, "project": true, "tags": true, \
            "description": false, "createdAt": false, "updatedAt": false, "startAt": false }'
    },
    {
        projectId: 'today',
        userId: 'default',
        viewType: 'kanban',
        getTasksOptions: '{"relativeDate": "today","limit": 20}',
        columns:
            '{ "endAt": true, "priority": true, "state": true, "project": true, "tags": true, \
            "description": false, "createdAt": false, "updatedAt": false, "startAt": false }'
    },
    {
        projectId: 'tomorrow',
        userId: 'default',
        viewType: 'kanban',
        getTasksOptions: '{"relativeDate": "tomorrow","limit": 20}',
        columns:
            '{ "endAt": true, "priority": true, "state": true, "project": true, "tags": true, \
            "description": false, "createdAt": false, "updatedAt": false, "startAt": false }'
    },
    {
        projectId: 'week',
        userId: 'default',
        viewType: 'table',
        getTasksOptions: '{"relativeDate": "week","limit": 80}',
        columns:
            '{ "endAt": true, "priority": true, "state": true, "project": true, "tags": true, \
            "description": false, "createdAt": false, "updatedAt": false, "startAt": false }'
    },
    {
        projectId: 'inbox',
        userId: 'default',
        viewType: 'table',
        getTasksOptions: '{"projectId": "inbox", "limit": 20}',
        columns:
            '{ "endAt": true, "priority": true, "state": true, "project": false, "tags": false, \
            "description": false, "createdAt": false, "updatedAt": false, "startAt": false }'
    },
    {
        projectId: 'favourite',
        userId: 'default',
        viewType: 'table',
        getTasksOptions: '{"isFavorited": true, "limit": 80}',
        columns:
            '{ "endAt": true, "priority": true, "state": true, "project": true, "tags": true, \
            "description": false, "createdAt": false, "updatedAt": false, "startAt": false }'
    },
    {
        projectId: 'givenup',
        userId: 'default',
        viewType: 'table',
        getTasksOptions: '{"isGivenUp": true, "limit": 80}',
        columns:
            '{ "endAt": true, "priority": true, "state": true, "project": true, "tags": true, \
            "description": false, "createdAt": false, "updatedAt": false, "startAt": false }'
    },
    {
        projectId: 'deleted',
        userId: 'default',
        viewType: 'table',
        getTasksOptions:
            '{"isDeleted": true, "sort": { "field": "deletedAt", "order": "desc" }, "limit": 20}',
        columns:
            '{ "endAt": true, "priority": true, "state": true, "project": true, "tags": true, \
            "description": false, "createdAt": false, "updatedAt": false, "startAt": false, \
            "deletedAt": true }'
    },
    {
        projectId: 'overdue',
        userId: 'default',
        viewType: 'table',
        getTasksOptions:
            '{"relativeDate": "-today", "state": "todo,in-progress", "sort": { "field": "endAt", "order": "desc" }, "limit": 20}',
        columns:
            '{ "endAt": true, "priority": true, "state": true, "project": true, "tags": false, \
            "description": false, "createdAt": false, "updatedAt": false, "startAt": false }'
    }
]
