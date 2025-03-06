import type { Todo } from '@nao-todo/types'

export type KanbanProps = {
    baseRoute: string
    disabledCreateTodo?: boolean
}

export type KanbanTodos = {
    [key in Todo['state']]: Todo[]
}
