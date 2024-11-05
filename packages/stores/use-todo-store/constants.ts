import type { TodoColumnOptions } from "./types"

export const defaultColumns : TodoColumnOptions = {
    state: false,
    priority: true,
    project: true,
    description: true,
    endAt: true,
    createdAt: false,
    updatedAt: false
}

export const defaultSortInfo = { field: '', order: '' }

export const defaultTodo = {
    id: '',
    userId: '',
    projectId: '',
    name: '',
    description: '',
    status: 'todo',
    state: 'todo',
    progress: { total: 0, finished: 0 },
    priority: 'low',
    createdAt: '',
    updatedAt: '',
    dueDate: { startAt: null, endAt: null },
    events: [],
    isPinned: false,
    isDone: false,
    isDeleted: false,
    tags: [],
    tagsInfo: [],
    project: {}
    // isNew: true
}