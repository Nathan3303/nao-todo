export type PagerProps = {
    page: number
    total?: number
    limit?: number
    totalPages: number
}

export type PagerEmits = {
    (event: 'perpageChange', value: number): void
    (event: 'pageChange', value: number): void
}
