import type { ProjectCreateOptions } from '@/stores'

export type CreateProjectDialogProps = {
    handler: (payload: ProjectCreateOptions) => Promise<any>
}

export type CreateProjectDialogEmits = {
    (event: 'create', payload: ProjectCreateOptions): void
}
