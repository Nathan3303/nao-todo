import type { Project, Tag, Todo } from '@nao-todo/types'

export type TodoCreatorProps = {
    presetInfo?: Partial<Todo>
    userId: Todo['userId']
    projects: Project[]
    tags: Tag[]
}

export type TodoCreatorEmits = {}
