import type { Project } from '@/stores'
import type { ComputedRef, Ref } from 'vue'

export type TasksProjectViewContext = {
    projectId: ComputedRef<Project['id']>
    project: Ref<Project | undefined>
}
