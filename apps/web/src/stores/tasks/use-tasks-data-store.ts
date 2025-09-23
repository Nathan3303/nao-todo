import { defineStore, storeToRefs } from 'pinia'
import { computed } from 'vue'
import { unwrapErrors } from '@nao-todo/utils'
import { useProjectStore, useTagStore, useTodoStore } from '@/stores/global'
import type { Err, Project, Tag } from '@nao-todo/types'

const useTasksDataStore = defineStore('TasksDataStore', () => {
    const projectStore = useProjectStore()
    const tagStore = useTagStore()
    const todoStore = useTodoStore()

    const { projects } = storeToRefs(projectStore)
    const { tags } = storeToRefs(tagStore)
    const { todos, pagination } = storeToRefs(todoStore)

    // @computed 智能清单列表
    const projectSmartListData = computed<Project[]>(() => {
        return projects.value.filter((project) => {
            return !project.isDeleted && !project.isArchived
        })
    })

    // @computed 智能清单列表
    const tagSmartListData = computed<Tag[]>(() => {
        return tags.value.filter((tag) => {
            return tag.deletedAt === null
        })
    })

    // @methods 获取清单列表和标签列表
    const getProjects = projectStore.getProjects
    const getTags = tagStore.getTags
    const getProjectsAndTags = async (): Promise<Err> => {
        const getProjectsError = await getProjects({})
        const getTagsError = await getTags({})
        return unwrapErrors(getProjectsError, getTagsError)
    }

    return {
        projects,
        tags,
        todos,
        pagination,
        projectSmartListData,
        tagSmartListData,
        getProjectsAndTags,
        getProjects,
        createProject: projectStore.createProject,
        deleteProject: projectStore.deleteProjectWithConfirm,
        restoreProject: projectStore.restoreProjectWithConfirm,
        deleteProjectPermanently: projectStore.deleteProjectPermanentlyWithConfirm,
        getTags,
        createTag: tagStore.createTag,
        deleteTag: tagStore.deleteTagWithConfirm,
        getTodos: todoStore.getTodos
    }
})

export default useTasksDataStore
