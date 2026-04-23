import { computed, reactive } from 'vue'
import type { ProjectManagerEmits, ProjectManagerProps, ProjectManagerVO } from './types'

const useProjectManager = (props: ProjectManagerProps, emit: ProjectManagerEmits) => {
    // @states
    const states = reactive<ProjectManagerVO>({ filterInfo: { name: '' }, activeTab: 'all' })

    // @computed 根据 filterInfo 和 activeTab 筛选清单
    const filteredProjects = computed(() => {
        const { name } = states.filterInfo
        return props.projects.filter((project) => {
            const nameMatch = name ? project.name.includes(name) : true
            let statusMatch = true
            if (states.activeTab === 'active') {
                statusMatch = !project.isDeleted
            } else if (states.activeTab === 'deleted') {
                statusMatch = project.isDeleted
            }
            return nameMatch && statusMatch
        })
    })

    // @methods
    const setActiveTab = (tab: 'all' | 'active' | 'deleted') => {
        states.activeTab = tab
    }

    // @emits
    const deleteProject = (id: string) => emit('deleteProject', id)
    const restoreProject = (id: string) => emit('restoreProject', id)

    // @returns
    return {
        states,
        filteredProjects,
        setActiveTab,
        deleteProject,
        restoreProject
    }
}

export default useProjectManager

