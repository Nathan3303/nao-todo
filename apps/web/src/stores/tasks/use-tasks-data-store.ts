import { computed } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { useRouter, useRoute } from 'vue-router'
import { unwrapErrors } from '@nao-todo/utils'
import {
    useProjectStore,
    useTagStore,
    useTodoStore,
    useEventStore,
    useCommentStore
} from '@/stores/global'
import type { Err, Project, Tag } from '@nao-todo/types'

const useTasksDataStore = defineStore('TasksDataStore', () => {
    const router = useRouter()
    const route = useRoute()
    const projectStore = useProjectStore()
    const tagStore = useTagStore()
    const todoStore = useTodoStore()
    const eventStore = useEventStore()
    const commentStore = useCommentStore()

    const { projects } = storeToRefs(projectStore)
    const { tags } = storeToRefs(tagStore)
    const { todos, pagination } = storeToRefs(todoStore)
    const { events } = storeToRefs(eventStore)
    const { comments } = storeToRefs(commentStore)

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

    // @methods 删除清单或标签的处理函数 - 主要处理当删除清单或标签为当前路由标签或清单时跳转
    const deleteProject = async (projectId: Project['id']) => {
        // 调用 ProjectStore 删除
        const err = await projectStore.deleteProjectWithConfirm(projectId)
        if (err !== 'ok') return
        // 删除成功则判断是否跳转
        if (route.params.id === projectId) {
            router.replace({ name: 'tasks-basic', params: { id: 'all' } })
        }
    }
    const deleteTag = async (tagId: Tag['id']) => {
        // 调用 TagStore 删除
        const err = await tagStore.deleteTagWithConfirm(tagId)
        if (err !== 'ok') return
        // 删除成功则判断是否跳转
        if (route.params.id === tagId) {
            router.replace({ name: 'tasks-basic', params: { id: 'all' } })
        }
    }

    // @returns
    return {
        projects,
        tags,
        todos,
        pagination,
        events,
        comments,
        projectSmartListData,
        tagSmartListData,
        getProjectsAndTags,
        getProjects,
        createProject: projectStore.createProject,
        deleteProject,
        restoreProject: projectStore.restoreProjectWithConfirm,
        deleteProjectPermanently: projectStore.deleteProjectPermanentlyWithConfirm,
        getTags,
        createTag: tagStore.createTag,
        deleteTag,
        getTodos: todoStore.getTodos,
        deleteTodo: todoStore.deleteTodoWithConfirm,
        restoreTodo: todoStore.restoreTodoWithConfirm,
        getEvents: eventStore.getEvents,
        createEvent: eventStore.createEvent,
        updateEvent: eventStore.updateEvent,
        deleteEvent: eventStore.deleteEvent,
        getComments: commentStore.getComments,
        createComment: commentStore.createComment,
        updateComment: commentStore.updateComment,
        deleteComment: commentStore.deleteComment
    }
})

export default useTasksDataStore
