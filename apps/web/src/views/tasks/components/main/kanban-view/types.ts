import type { Todo } from '@nao-todo/types'

export type KanbanTodos = {
    [key in Todo['state']]: Todo[]
}
