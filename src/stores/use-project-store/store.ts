import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { CreateProjectPayload, Project } from './types'
import { useUserStore } from '../use-user-token'
import { NueMessage } from 'nue-ui'
import $axios from './axios'

export const useProjectStore = defineStore('projectStore', () => {
    const userStore = useUserStore()
    const projects = ref<Project[]>([])

    async function getProjects() {
        const userId = userStore.user?.id
        if (!userId) {
            NueMessage.error('Please login first')
            return
        }
        const response = await $axios.get(`/projects?userId=${userId}`)
        if (response.data.code === '20000') {
            projects.value = response.data.data
        }
        return response.data
    }

    async function createProject(payload: CreateProjectPayload) {
        // console.log(payload)
        const userId = userStore.user?.id
        const response = await $axios.post('/project', { userId, ...payload })
        // console.log(response.data)
        if (response.data.code === '20000') {
            console.log(response.data.data)
            projects.value.push(response.data.data as Project)
            NueMessage.success('Project created successfully')
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
            NueMessage.success('Project deleted successfully')
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
            NueMessage.success('Project updated successfully')
        } else {
            NueMessage.error(response.data.message)
        }
        return response.data
    }

    return { projects, getProjects, createProject, deleteProject, updateProject }
})
