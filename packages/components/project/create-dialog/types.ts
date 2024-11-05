import type { ProjectCreateOptions } from '@nao-todo/stores'

export type CreateProjectDialogProps = {
    handler: (payload: ProjectCreateOptions) => Promise<any>
}

export type CreateProjectDialogEmits = {
    (event: 'create', payload: ProjectCreateOptions): void
}
