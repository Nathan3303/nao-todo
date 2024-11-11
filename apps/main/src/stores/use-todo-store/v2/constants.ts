import { FetchTodosOptions } from './types'

export const defaultFetchTodosOptions: FetchTodosOptions = {
    isDeleted: false,
    page: 1,
    limit: 20,
    sort: { field: 'createdAt', order: 'desc' }
}
