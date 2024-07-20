import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { CreateProjectPayload, Project } from './types'
import { useUserStore } from '../use-user-store'
import { NueMessage } from 'nue-ui'
import { naoTodoServer } from '@/axios'

export const useProjectStore = defineStore('projectStore', () => {
    const userStore = useUserStore()
    const projects = ref<Project[]>([])
    const archivedProjects = ref<Project[]>([])

    async function getProjects() {
        const userId = userStore.user?.id
        if (!userId) {
            NueMessage.error('请先登录')
            return
        }
        const response = await naoTodoServer.get(`/projects?userId=${userId}`)
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
        const response = await naoTodoServer.get(URI)
        if (response.data.code === '20000') {
            archivedProjects.value = response.data.data
        }
        return response.data
    }

    async function createProject(payload: CreateProjectPayload) {
        // console.log(payload)
        const userId = userStore.user?.id
        const response = await naoTodoServer.post('/project', { userId, ...payload })
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
        const response = await naoTodoServer.delete('/project' + `?projectId=${projectId}`)
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
        const response = await naoTodoServer.put('/project' + `?projectId=${projectId}`, payload)
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

    return {
        projects,
        archivedProjects,
        getProjects,
        createProject,
        deleteProject,
        updateProject,
        getArchivedProjects,
        archiveProject,
        unarchiveProject
    }
})
