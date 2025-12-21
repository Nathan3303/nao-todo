export type BuiltInProject = {
    id: string
    icon: string
    name: string
    description: string
    createTasksOptions: Record<string, unknown>
}

export type BuiltInProjectPreference = {
    projectId: BuiltInProject['id']
    userId: string
    viewType: string
    getTasksOptions: string
    columns: string
}
