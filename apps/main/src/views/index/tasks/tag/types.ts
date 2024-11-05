import type { Tag } from '@nao-todo/stores'
import type { ComputedRef, Ref } from 'vue'

export type TasksTagViewContext = {
    tagId: ComputedRef<Tag['id']>
    tag: Ref<Tag | undefined>
}
