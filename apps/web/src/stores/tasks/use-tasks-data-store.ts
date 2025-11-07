import { computed } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { useRouter, useRoute } from 'vue-router'
import { unwrapErrors } from '@nao-todo/utils'
import {
    useProjectStore,
    useTagStore,
    useTodoStore,
    useEventStore,
    useCommentStore,
    useUserStoreV2
} from '@/stores/global'
import type { Err, Project, Tag, Todo } from '@nao-todo/types'

const useTasksDataStore = defineStore('TasksDataStore', () => {
    // @stores 全局 stores
    const router = useRouter()
    const route = useRoute()
    const projectStore = useProjectStore()
    const tagStore = useTagStore()
    const todoStore = useTodoStore()
    const eventStore = useEventStore()
    const commentStore = useCommentStore()
    const userStore = useUserStoreV2()

    // @states 前置状态
    const { projects } = storeToRefs(projectStore)
    const { tags } = storeToRefs(tagStore)
    const { todos, pagination } = storeToRefs(todoStore)
    const { events } = storeToRefs(eventStore)
    const { comments } = storeToRefs(commentStore)
    const { user } = storeToRefs(userStore)

    // @computed 智能清单列表
    const projectSmartListData = computed<Project[]>(() => {
        return projects.value.filter((project) => {
            return !project.isDeleted && !project.isArchived
        })
    })

    // @computed 智能标签列表
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

    // @methods 删除清单处理函数 - 主要处理当删除清单后的跳转
    const deleteProject = async (projectId: Project['id']) => {
        // 调用 ProjectStore 删除
        const err = await projectStore.deleteProjectWithConfirm(projectId)
        if (err !== 'ok') return
        // 删除成功则判断是否跳转
        if (route.params.id === projectId) {
            router.replace({ name: 'tasks-basic', params: { id: 'all' } })
        }
    }

    // @methods 删除标签处理函数 - 主要处理当删除标签后的跳转
    const deleteTag = async (tagId: Tag['id']) => {
        // 调用 TagStore 删除
        const err = await tagStore.deleteTagWithConfirm(tagId)
        if (err !== 'ok') return
        // 删除成功则判断是否跳转
        if (route.params.id === tagId) {
            router.replace({ name: 'tasks-basic', params: { id: 'all' } })
        }
    }

    // @methods 删除待办任务的处理函数 - 主要处理删除待办任务后的跳转
    const deleteTodo = async (todoId: Todo['id']): Promise<boolean> => {
        // 调用 TodoStore 删除
        const err = await todoStore.deleteTodoWithConfirm(todoId)
        if (err !== 'ok') return false
        // 删除成功则判断是否跳转
        if (route.params.id === todoId) {
            router.replace({ name: 'tasks-basic', params: { id: 'all' } })
        }
        return true
    }

    // @methods 永久删除待办任务处理函数 - 主要处理当永久删除待办任务后的跳转
    const deleteTodoPermanently = async (todoId: Todo['id']): Promise<boolean> => {
        // 调用 TodoStore 删除
        const err = await todoStore.deleteTodoPermanentlyWithConfirm(todoId)
        if (err !== 'ok') return false
        // 删除成功则判断是否跳转
        if (route.params.id === todoId) {
            router.replace({ name: 'tasks-basic', params: { id: 'all' } })
        }
        return true
    }

    // @returns
    return {
        user,
        getProjectsAndTags,
        // project
        projects,
        projectSmartListData,
        getProjects,
        getProjectNameById: projectStore.getProjectNameById,
        createProject: projectStore.createProject,
        deleteProject,
        restoreProject: projectStore.restoreProjectWithConfirm,
        deleteProjectPermanently: projectStore.deleteProjectPermanentlyWithConfirm,
        // tag
        tags,
        tagSmartListData,
        getTags,
        createTag: tagStore.createTag,
        deleteTag,
        // todos
        todos,
        pagination,
        getTodos: todoStore.getTodos,
        getTodosWithPush: todoStore.getTodosWithPush,
        deleteTodo,
        deleteTodoPermanently,
        restoreTodo: todoStore.restoreTodoWithConfirm,
        duplicateTodo: todoStore.duplicateTodoWithComfirm,
        updateTodoState: todoStore.updateTodoState,
        clearTodos: todoStore.__resetStates,
        // event
        events,
        getEvents: eventStore.getEvents,
        createEvent: eventStore.createEvent,
        updateEvent: eventStore.updateEvent,
        deleteEvent: eventStore.deleteEvent,
        updateEvents: eventStore.updateEvents,
        sortEventOnly: eventStore.sortEventOnly,
        // comment
        comments,
        getComments: commentStore.getComments,
        createComment: commentStore.createComment,
        updateComment: commentStore.updateComment,
        deleteComment: commentStore.deleteComment
    }
})

export default useTasksDataStore
