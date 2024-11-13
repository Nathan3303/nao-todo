import type { Project } from '@/stores'
import type { Ref } from 'vue'

export type ProjectViewContext = {
    project: Ref<Project | null>
}
