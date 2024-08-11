import type { ProjectCreateOptions } from '@/stores'

export type CreateProjectDialogProps = {}

export type CreateProjectDialogEmits = {
    (event: 'create', payload: ProjectCreateOptions): void
}
