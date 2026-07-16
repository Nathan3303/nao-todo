export type PagerProps = {
    page: number
    total?: number
    limit?: number
    totalPages: number
    simple?: boolean
    disabled?: boolean
}

export type PagerEmits = {
    (event: 'perPageChange', value: number): void
    (event: 'pageChange', value: number): void
}
