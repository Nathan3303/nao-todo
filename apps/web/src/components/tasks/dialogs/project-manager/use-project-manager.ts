import { computed, reactive } from 'vue'
import type { ProjectManagerEmits, ProjectManagerProps, ProjectManagerVO } from './types'

const useProjectManager = (props: ProjectManagerProps, emit: ProjectManagerEmits) => {
    // @states
    const states = reactive<ProjectManagerVO>({
        filterInfo: { name: '', onlyDeleted: false }
    })

    // @computed 根据 filterInfo 筛选清单
    const filteredProjects = computed(() => {
        const { name, onlyDeleted } = states.filterInfo
        return props.projects.filter((project) => {
            const nameMatch = name ? project.name.includes(name) : true
            const isDeletedMatch = onlyDeleted ? project.isDeleted : true
            return nameMatch && isDeletedMatch
        })
    })

    // @emits
    const deleteProject = (id: string) => emit('deleteProject', id)
    const restoreProject = (id: string) => emit('restoreProject', id)
    const hardDeleteProject = (id: string) => emit('hardDeleteProject', id)

    // @returns
    return {
        states,
        filteredProjects,
        deleteProject,
        restoreProject,
        hardDeleteProject
    }
}

export default useProjectManager
