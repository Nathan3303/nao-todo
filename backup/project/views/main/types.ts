import type { Ref } from 'vue'
import type { Project } from '@/stores/use-project-store'

export type ProjectViewContext = {
    currentProject: Ref<Project>
}
