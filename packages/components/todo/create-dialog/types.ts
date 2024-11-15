import type { TodoCreatorEmits, TodoCreatorProps } from '../creator/types'

export type TodoCreateDialogProps = {
    handler: (TodoCreatorProps) => Promise<any>
}

export type TodoCreateDialogEmits = {} & TodoCreatorEmits

export type TodoCreateDialogArgs = {} & TodoCreatorProps
