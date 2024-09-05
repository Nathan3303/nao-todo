import type { Todo } from '@/stores'

export type UnusedTagOption = {
    label: string
    value: string
}

export type TodoTagDetailsProps = {
    todoId: Todo['id']
    todoTags: Todo['tags']
}

export type TodoTagDetailsEmits = {
    (event: 'updateTags', tags: Todo['tags']): void
}
