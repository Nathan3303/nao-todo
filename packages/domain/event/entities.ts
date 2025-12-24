export type EventEntity = {
    id: string
    taskId: string
    name: string
    description: string
    isDone: boolean
    sortId: number
}

export const makeEventEntity = (): EventEntity => {
    return {
        id: '',
        taskId: '',
        name: '',
        description: '',
        isDone: false,
        sortId: 0
    }
}
