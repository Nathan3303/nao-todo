import type { Ref } from 'vue'
import type { Project } from '@/stores/useProjectStore'

export type ProjectViewContext = {
    currentProject: Ref<Project>
}
