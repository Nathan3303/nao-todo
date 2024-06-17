import type { Project } from '@/stores/useProjectStore'

export type ProjectViewContext = {
    projectId: Project['id']
    currentProject: Project
}
