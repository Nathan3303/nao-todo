import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { nanoid } from 'nanoid'
import { findOne } from '@/utils/utils'

const LOCAL_STORAGE_KEY = '@projects'

export type Project = {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    created_at?: string
    updated_at?: string
}

export const useProjectStore = defineStore('projectStore', () => {
    const projects = ref<Project[]>([])
    const selectedProject = ref<Project | null>(null)

    function _buildProject(name: string, description?: string) {
        const timeString = new Date().toString()
        const project: Project = {
            id: nanoid(),
            name,
            description,
            createdAt: timeString,
            updatedAt: timeString
        }
        return project
    }

    function create(name: string, description?: string) {
        name = name.trim()
        return new Promise((resolve, reject) => {
            if (name === '') {
                reject('Project name is required')
            } else {
                const newProject = _buildProject(name, description)
                if (findOne(projects.value, (p) => p.name === newProject.name)) {
                    reject('Project name is already used')
                } else {
                    projects.value.unshift(newProject)
                    resolve('Project created successfully')
                }
            }
        })
    }

    function remove(id: Project['id']) {
        return new Promise((resolve, reject) => {
            const project = projects.value.find((p) => p.id === id)
            if (project) {
                const index = projects.value.indexOf(project)
                const spliced = projects.value.splice(index, 1)
                // console.log(spliced)
                if (spliced) {
                    resolve('Project removed successfully')
                } else {
                    reject('Failed to remove project')
                }
            }
        })
    }

    function update(id: Project['id'], paylod: Partial<Project>) {
        return new Promise((resolve, reject) => {
            const project = projects.value.find((p) => p.id === id)
            if (project) {
                const index = projects.value.indexOf(project)
                const updated = {
                    ...project,
                    ...paylod,
                    updateAt: new Date().toString()
                }
                projects.value.splice(index, 1, updated)
                resolve('Project updated successfully')
            } else {
                reject('Project not found')
            }
        })
    }

    function read() {
        const string = localStorage.getItem(LOCAL_STORAGE_KEY)
        if (string) {
            projects.value = JSON.parse(string)
        }
    }

    function filter(how: (p: Project, i: number) => boolean): Project[] {
        return projects.value.filter((project, index) => {
            return how(project, index)
        })
    }

    function commit() {
        const string = JSON.stringify(projects.value)
        localStorage.setItem(LOCAL_STORAGE_KEY, string)
    }

    watch(
        () => projects.value,
        () => commit(),
        { deep: true }
    )

    return {
        projects,
        selectedProject,
        create,
        remove,
        update,
        read,
        filter
    }
})
