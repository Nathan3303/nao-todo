import type { Tag, Todo } from "@/stores"

export type TodoTagBarProps = {
    tags: Tag[]
    todoTags: Todo['tags']
}

export type TodoTagBarEmits = {
    (event: 'updateTags', tags: Todo['tags']): void
}
