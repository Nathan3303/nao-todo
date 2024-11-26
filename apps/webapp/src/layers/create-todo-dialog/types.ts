import type { TodoCreatorProps } from '@nao-todo/components/todo/creator/types'
import type { CreateTodoOptions } from '@nao-todo/types'

export type CreateTodoDialogProps = {
    handler: (options: CreateTodoOptions) => Promise<boolean>
}

export type CreateTodoDialogCallerArgs = TodoCreatorProps
