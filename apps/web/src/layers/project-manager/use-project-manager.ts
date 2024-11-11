import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStoreV2 } from '@/stores/use-project-store'
import { createProjectWithConfirmation } from '@/handlers'
import type { CreateProjectOptions } from '@/stores/use-project-store/v2/types'

export const useProjectManager = () => {
    const projectStore = useProjectStoreV2()

    const { projects } = storeToRefs(projectStore)

    const loading = ref(false)

    const handleCreateProject = async (payload: CreateProjectOptions) => {
        await createProjectWithConfirmation(payload)
    }

    return {
        loading,
        projects,
        handleCreateProject
    }
}
