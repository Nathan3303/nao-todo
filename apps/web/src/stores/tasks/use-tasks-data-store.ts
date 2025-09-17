import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
    createProjectHandler,
    getProjectsHandler,
    createTagHandler,
    getTagsHandler
} from '@nao-todo/handlers/v1'
import type { Err, Project, Tag, Todo } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/utils'
import { useAxios } from '@nao-todo/hooks'

type Projects = Project[]
type Tags = Tag[]
type Todos = Todo[]

const requester = useAxios('http://localhost:3303/api/')

const useTasksDataStore = defineStore('TasksDataStore', () => {
    const projects = ref<Projects>([])
    const tags = ref<Tags>([])
    const todos = ref<Todos>([])

    // 智能清单列表
    const projectSmartListData = computed<Projects>(() => {
        return projects.value.filter((project) => {
            return project.deletedAt === null && project.archivedAt === null
        })
    })

    // 智能清单列表
    const tagSmartListData = computed<Tags>(() => {
        return tags.value.filter((tag) => {
            return tag.deletedAt === null
        })
    })

    // 获取清单列表和标签列表
    const getProjectsAndTags = async (): Promise<Err> => {
        // 获取清单列表
        const [_projects, getProjectsError] = await getProjectsHandler({}, requester)
        if (!getProjectsError) projects.value = _projects
        const [_tags, getTagsError] = await getTagsHandler({}, requester)
        if (!getTagsError) tags.value = _tags
        return getProjectsError
    }

    // 创建清单
    const createProject = async (
        name: Project['name'],
        description?: Project['description']
    ): Promise<Err> => {
        // 参数判断
        if (!name) return '清单名称不能为空'
        // 创建清单
        const [res, err] = await createProjectHandler({ name: name, description }, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        projects.value.push(res)
        return null
    }

    // 创建标签
    const createTag = async (
        name: Tag['name'],
        color: Tag['color'],
        description: Tag['description']
    ): Promise<Err> => {
        // 参数判断
        if (!name) return '清单名称不能为空'
        if (!color) return '标签颜色不能为空'
        // 创建标签
        const [res, err] = await createTagHandler({ name, color, description })
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        tags.value.push(res)
        return null
    }

    return {
        projects,
        tags,
        todos,
        projectSmartListData,
        tagSmartListData,
        getProjectsAndTags,
        createProject,
        createTag
    }
})

export default useTasksDataStore
