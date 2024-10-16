import type { Tag } from '@/stores'
import type { ComputedRef, Ref } from 'vue'

export type TasksTagViewContext = {
    tagId: ComputedRef<Tag['id']>
    tag: Ref<Tag | undefined>
}
