import type { Todo } from '@/stores'
import type { Ref } from 'vue'

export type TasksViewContext = {
    isShowMultiDetails: Ref<boolean>
    handleShowMultiDetails: (selectedIds: Todo['id'][]) => void
    handleHideMultiDetails: () => void
}
