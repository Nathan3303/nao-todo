import type { Todo } from '@/stores'

export type TasksViewContext = {
    handleShowMultiDetails: (selectedIds: Todo['id'][]) => void
    handleHideMultiDetails: () => void
}
