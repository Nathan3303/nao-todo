import type { TodoCreatorEmits, TodoCreatorProps } from '@nao-todo/components/todo/creator/types'

export type TodoCreateDialogProps = {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    handler: Function
}

export type TodoCreateDialogEmits = {} & TodoCreatorEmits

export type TodoCreateDialogArgs = {} & TodoCreatorProps
