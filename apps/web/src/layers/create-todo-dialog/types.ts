import type { TodoCreatorProps } from '@nao-todo/components/todo/creator/types'
import type { CreateTodoOptions } from '@nao-todo/types'

export type TodoCreateDialogProps = {
    handler: (options: CreateTodoOptions) => Promise<boolean>
}

export type TodoCreateDialogArgs = {} & TodoCreatorProps
