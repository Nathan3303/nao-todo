import type { CreateTodoOptions, Project, Tag, Todo } from '@nao-todo/types'

type TodoCreatorProps = {
    presetInfo?: Partial<CreateTodoOptions> & { project?: { title: string } }
    userId: Todo['userId']
    projects: Project[]
    tags: Tag[]
}

export type { TodoCreatorProps }
