import type { Project, Tag, Todo } from '@nao-todo/stores'

export type TodoCreatorProps = {
    presetInfo?: Partial<Todo>
    userId: Todo['userId']
    projects: Project[]
    tags: Tag[]
}

export type TodoCreatorEmits = {}
