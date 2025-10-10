import { reactive, ref, watch } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { useTasksDataStore } from '@/stores/tasks'
import { useRoute, useRouter } from 'vue-router'
import type { Project } from '@nao-todo/types'

type FilterInfo = {
    name: string
    isArchived: null | boolean
    isDeleted: null | boolean
}

const useProjectManagerStore = defineStore('ProjectManagerStore', () => {
    const tasksDataStore = useTasksDataStore()
    const route = useRoute()
    const router = useRouter()

    const { projects: projectsRaw } = storeToRefs(tasksDataStore)

    const projects = ref<Project[]>([])

    const filterInfo = reactive<FilterInfo>({
        name: '',
        isArchived: null,
        isDeleted: null
    })

    // 筛选清单处理函数
    const nameFilterHandler = (project: Project) => {
        const name = filterInfo.name
        if (name === '') return true
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
    const loadProjects = () => {
        const handlers = [nameFilterHandler, isArchivedFilterHandler, isDeletedFilterHandler]
        projects.value = projectsRaw.value.filter((project) =>
            handlers.every((handler) => handler(project))
        ) as Project[]
    }

    // 处理删除当前清单后路由跳转
    const switchRouteIfDelete = (comparedProjectId: Project['id']) => {
        const projectIdOnRoute = route.params.projectId as string
        if (projectIdOnRoute !== comparedProjectId) return
        return router.replace({ name: 'tasks-all' })
    }

    // 删除清单
    const deleteProject = async (projectId: Project['id']) => {
        await tasksDataStore.deleteProject(projectId)
    }

    // 恢复清单
    const restoreProject = async (projectId: Project['id']) => {
        await tasksDataStore.restoreProject(projectId)
    }

    // 永久删除清单
    const hardDeleteProject = async (projectId: Project['id']) => {
        const ok = await tasksDataStore.deleteProjectPermanently(projectId)
        if (ok) await switchRouteIfDelete(projectId)
    }

    // 监听过滤选项变化，重新加载数据
    watch(
        () => [filterInfo, projectsRaw.value],
        () => loadProjects(),
        { immediate: true, deep: true }
    )

    return {
        projects,
        filterInfo,
        loadProjects,
        getProjectsAgain: tasksDataStore.getProjects,
        deleteProject,
        hardDeleteProject,
        restoreProject
    }
})

export default useProjectManagerStore
