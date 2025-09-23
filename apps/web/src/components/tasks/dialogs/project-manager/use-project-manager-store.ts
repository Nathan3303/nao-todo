import { computed, reactive } from 'vue'
import useProjectsFilter from './use-projects-filter'
import { defineStore } from 'pinia'
import { useTasksDataStore } from '@/stores/tasks'
import { useRoute, useRouter } from 'vue-router'
import type { Project } from '@nao-todo/types'

type FilterInfo = {
    name: string
    isArchived: null | boolean
    isDeleted: null | boolean
}

const useProjectManagerStore = defineStore('ProjectManagerStore', () => {
    const projectsFilter = useProjectsFilter()
    const tasksDataStore = useTasksDataStore()
    const route = useRoute()
    const router = useRouter()

    const filterInfo = reactive<FilterInfo>({
        name: '',
        isArchived: null,
        isDeleted: null
    })

    // 筛选清单处理函数
    const nameFilterHandler = (project: Project) => {
        const name = filterInfo.name
        if (name == '') return true
        return project.name.includes(name)
    }
    const isArchivedFilterHandler = (project: Project) => {
        const isArchived = filterInfo.isArchived
        if (isArchived === null) return true
        if (isArchived) return project.archivedAt !== null
        return project.archivedAt === null
    }
    const isDeletedFilterHandler = (project: Project) => {
        const isDeleted = filterInfo.isDeleted
        if (isDeleted === null) return true
        if (isDeleted) return project.deletedAt !== null
        return project.deletedAt === null
    }

    // 筛选清单列表
    const projects = computed(() => {
        return projectsFilter.filter(
            nameFilterHandler,
            isArchivedFilterHandler,
            isDeletedFilterHandler
        )
    })

    // 处理删除当前清单后路由跳转
    const switchRouteIfDelete = (comparedProjectId: Project['id']) => {
        const projectIdOnRoute = route.params.projectId as string
        if (projectIdOnRoute !== comparedProjectId) return
        return router.replace({ name: 'tasks-all' })
    }

    // 删除清单
    const deleteProject = async (projectId: Project['id']) => {
        const ok = await tasksDataStore.deleteProject(projectId)
        if (ok === 'ok') await switchRouteIfDelete(projectId)
    }

    // 恢复清单
    const restoreProject = async (projectId: Project['id']) => {
        await tasksDataStore.restoreProject(projectId)
    }

    // 永久删除清单
    const hardDeleteProject = async (projectId: Project['id']) => {
        const ok = await tasksDataStore.deleteProjectPermanently(projectId)
        if (ok === 'ok') await switchRouteIfDelete(projectId)
    }

    return {
        projects,
        filterInfo,
        getProjectsAgain: tasksDataStore.getProjects,
        deleteProject,
        hardDeleteProject,
        restoreProject
    }
})

export default useProjectManagerStore
