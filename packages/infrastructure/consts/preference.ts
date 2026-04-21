export const defaultPreferenceColumns = {
    state: true,
    priority: true,
    endAt: true,
    project: false,
    tags: false,
    description: false,
    createdAt: false,
    updatedAt: false,
    startAt: false
}

export const defaultPreference = {
    viewType: 'table',
    getTasksOptions: '{}',
    columns: JSON.stringify(defaultPreferenceColumns)
}

