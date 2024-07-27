import { reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { useUserStore } from '../use-user-store'
import { NueMessage } from 'nue-ui'
import { naoTodoServer as $axios } from '@/axios'
import type { User } from '@/stores'
import type {
    PageInfo,
    CreateProjectPayload,
    Project,
    ProjectFilterOptions,
    ProjectUpdateOptions
} from './types'

export const useProjectStore = defineStore('projectStore', () => {
    const userStore = useUserStore()
    const project = ref<Project>()
    const projects = ref<Project[]>([])
    const archivedProjects = ref<Project[]>([])
    const AllProjects = ref<Project[]>([])

    const filterInfo = ref<ProjectFilterOptions>({})
    const pageInfo = reactive<PageInfo>({ page: 1, limit: 10, total: 0 })

    async function getProjects() {
        const userId = userStore.user?.id
        if (!userId) {
            NueMessage.error('请先登录')
            return
        }
        const response = await $axios.get(`/projects?userId=${userId}`)
        if (response.data.code === '20000') {
            // console.log(response.data.data)
            response.data.data.forEach((project: Project) => {
                if (project.isArchived) {
                    // archivedProjects.value.push(project)
                } else {
                    projects.value.push(project)
                }
            })
            // projects.value = response.data.data
        }
        return response.data
    }

    const getArchivedProjects = async () => {
        const { id: userId } = userStore.user!
        const URI = `/projects?userId=${userId}&isArchived=true`
        // console.log(URI)
        const response = await $axios.get(URI)
        if (response.data.code === '20000') {
            archivedProjects.value = response.data.data
        }
        return response.data
    }

    async function createProject(payload: CreateProjectPayload) {
        // console.log(payload)
        const userId = userStore.user?.id
        const response = await $axios.post('/project', { userId, ...payload })
        // console.log(response.data)
        if (response.data.code === '20000') {
            // console.log(response.data.data)
            projects.value.push(response.data.data as Project)
            NueMessage.success('项目创建成功')
        } else {
            NueMessage.error(response.data.message)
        }
        return response.data
    }

    async function deleteProject(projectId: string) {
        const response = await $axios.delete('/project' + `?projectId=${projectId}`)
        if (response.data.code === '20000') {
            const index = projects.value.findIndex((project) => project.id === projectId)
            projects.value.splice(index, 1)
            NueMessage.success('项目删除成功')
        } else {
            NueMessage.error(response.data.message)
        }
        return response.data
    }

    async function updateProject(projectId: string, payload: Partial<Project>) {
        const response = await $axios.put('/project' + `?projectId=${projectId}`, payload)
        if (response.data.code === '20000') {
            const index = projects.value.findIndex((project) => project.id === projectId)
            const newProject = { ...projects.value[index], ...payload }
            projects.value[index] = newProject as Project
            NueMessage.success('项目更新成功')
        } else {
            NueMessage.error(response.data.message)
        }
        return response.data
    }

    async function archiveProject(projectId: string) {
        const response = await updateProject(projectId, { isArchived: true })
        if (response.code === '20000') {
            const index = projects.value.findIndex((project) => project.id === projectId)
            const project = projects.value[index]
            projects.value.splice(index, 1)
            archivedProjects.value.push(project)
        }
        return response
    }

    const unarchiveProject = async (projectId: string) => {
        const response = await updateProject(projectId, { isArchived: false })
        if (response.code === '20000') {
            const index = archivedProjects.value.findIndex((project) => project.id === projectId)
            const project = archivedProjects.value[index]
            projects.value.push(project)
            archivedProjects.value.splice(index, 1)
        }
        return response
    }

    /** New API Start */

    const parseFilterInfoToQuery = (specFilterInfo?: ProjectFilterOptions) => {
        const query: string[] = []
        const _filterInfo = specFilterInfo || filterInfo.value
        // console.log(_filterInfo)
        Object.keys(_filterInfo).forEach((key) => {
            const value = _filterInfo[key as keyof ProjectFilterOptions]
            query.push(`${key}=${value}`)
        })
        const queryString = query.join('&')
        return queryString
    }

    const _mergeFilterInfo = (newOne: ProjectFilterOptions) => {
        filterInfo.value = {
            ...filterInfo.value,
            ...newOne
        }
    }

    const _getData = async (userId: User['id']) => {
        const { page, limit } = pageInfo
        const filterQueryString = parseFilterInfoToQuery()
        const pageQueryString = `page=${page}&limit=${limit}`
        const URI = `/projects?userId=${userId}&${pageQueryString}&${filterQueryString}`
        // console.log(URI)
        const response = await $axios.get(URI)
        return response.data
    }

    const reset = () => {
        projects.value = []
        filterInfo.value = {}
    }

    const init = async (userId: User['id'], filterInfo: ProjectFilterOptions) => {
        reset()
        _mergeFilterInfo(filterInfo)
        return await reload(userId)
    }

    const reload = async (userId: User['id']) => {
        const response = await _getData(userId)
        if (response.code === '20000') {
            projects.value = response.data
        }
        return response
    }

    const get = async (userId: User['id'], filterInfo?: ProjectFilterOptions) => {
        const { page, limit } = pageInfo
        const filterQueryString = parseFilterInfoToQuery(filterInfo)
        const pageQueryString = `page=${page}&limit=${limit}`
        const URI = `/projects?userId=${userId}&${pageQueryString}&${filterQueryString}`
        // console.log(URI)
        const response = await $axios.get(URI)
        return response.data
    }

    const toFindLocally = (id: Project['id']) => {
        const project = projects.value.find((project) => project.id === id)
        if (!project) return null
        return project
    }

    const update = async (
        userId: User['id'],
        id: Project['id'],
        updateOptions: ProjectUpdateOptions
    ) => {
        const URI = `/project?userId=${userId}&id=${id}`
        const idx = projects.value.findIndex((project) => project.id === id)
        const project = projects.value[idx]
        const newProject = { ...project, ...updateOptions }
        // console.log(userId, id, updateInfo, newTodo)
        const response = await $axios.put(URI, newProject)
        if (response.data.code === '20000') {
            // todos.value[todoIdx] = response.data.data
            // console.log(filterInfo.value)
            // await get(userId)
        }
        return response.data
    }

    /** New API End */

    return {
        project,
        projects,
        archivedProjects,
        AllProjects,
        filterInfo,
        pageInfo,
        getProjects,
        createProject,
        deleteProject,
        updateProject,
        getArchivedProjects,
        archiveProject,
        unarchiveProject,
        init,
        reload,
        update,
        get,
        toFindLocally
    }
})
