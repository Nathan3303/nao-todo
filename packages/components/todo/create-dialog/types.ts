import type { TodoCreatorEmits, TodoCreatorProps } from '../creator/types'

export type TodoCreateDialogProps = {
    handler: Function
}

export type TodoCreateDialogEmits = {} & TodoCreatorEmits

export type TodoCreateDialogArgs = {} & TodoCreatorProps
