import { ref, computed } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { basicViewProps, columnTexts } from './constants'
import { parsePreference, toObject } from './utils'
import { useProjectStore, useTagStore, useTodoStore, useViewStore } from '@/stores/global'
import { NuePrompt, NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/utils'
import type { TasksMainViewProps } from '@/layouts/tasks/'
import type { Err, ProjectPreference, TodoColumnOptions } from '@nao-todo/types'

const USER_TASKS_BASIC_VIEW_PREFERENCE_LSKEY = 'USER_TASKS_BASIC_VIEW_PREFERENCE'

const useTasksViewStore = defineStore('TasksViewStore', () => {
    // @states 全局 Store
    const projectStore = useProjectStore()
    const tagStore = useTagStore()
    const todoStore = useTodoStore()
    const viewStore = useViewStore()

    // @states 前置状态
    const { tags } = storeToRefs(tagStore)
    const { projects } = storeToRefs(projectStore)
    const {
        responsiveFlag,
        appAsideStates,
        globalAsideWidth,
        globalOutlineWidth,
        isUseFloatTasksAsideDefaultly,
        isUseFloatTasksOutlineDefaultly,
        tasksAsideNavLinkVisible
    } = storeToRefs(viewStore)

    // @states 是否显示侧边栏
    const isDisplayAside = ref<boolean>(true)

    // @computed 是否使用浮动侧边栏
    const isUseFloatAside = computed(() => {
        const flag = responsiveFlag.value < 2 || isUseFloatTasksAsideDefaultly.value
        appAsideStates.value.floating = flag || false
        return flag
    })

    // @computed 是否使用浮动任务详情侧边栏
    const isUseFloatOutline = computed(() => {
        return responsiveFlag.value < 3 || isUseFloatTasksOutlineDefaultly.value
    })

    // @method 切换侧边栏显示状态
    const switchIsDisplayAside = () => {
        // 判断是否是浮动侧边栏
        if (isUseFloatAside.value) {
            appAsideStates.value.visible = !appAsideStates.value.visible
            return
        }
        isDisplayAside.value = !isDisplayAside.value
    }

    // @state 视图全局属性
    const viewProps = ref<TasksMainViewProps>()

    // @state 视图加载状态
    const viewPropsLoadState = ref<number>(0)

    // @method 加载基础视图全局属性 - 由 加载视图全局属性 调用
    const loadBasicViewProps = async (id: string): Promise<TasksMainViewProps | undefined> => {
        const res = basicViewProps.find((vp) => vp.id === id)
        if (!res) return
        const result: Partial<TasksMainViewProps> = {}
        result.id = res.id
        result.category = res.category
        result.icon = res.icon
        result.name = res.name
        result.description = res.description
        const localPreference = toObject(
            localStorage.getItem(`${USER_TASKS_BASIC_VIEW_PREFERENCE_LSKEY}/${id}`),
            res.preference
        ) as ProjectPreference
        result.preference = parsePreference(localPreference)
        return result as TasksMainViewProps
    }

    // @method 加载项目视图全局属性 - 由 加载视图全局属性 调用
    const loadProjectViewProps = async (id: string): Promise<TasksMainViewProps | undefined> => {
        const project = projects.value.find((p) => p.id === id)
        if (!project) return
        const result: Partial<TasksMainViewProps> = {}
        result.id = project.id
        result.category = 'project'
        result.icon = ''
        result.name = project.name
        result.description = project.description
        result.preference = parsePreference(project.preference)
        result.createTodoOptions = {
            projectId: project.id
        }
        return result as TasksMainViewProps
    }

    // @method 加载标签视图全局属性 - 由 加载视图全局属性 调用
    const loadTagViewProps = async (id: string): Promise<TasksMainViewProps | undefined> => {
        const tag = tags.value.find((t) => t.id === id)
        if (!tag) return
        const result: Partial<TasksMainViewProps> = {}
        result.id = tag.id
        result.category = 'tag'
        result.icon = ''
        result.name = tag.name
        result.description = tag.description
        result.preference = parsePreference(tag.preference)
        result.createTodoOptions = {
            tags: [tag.id]
        }
        return result as TasksMainViewProps
    }

    // @method 加载视图全局属性 - 根据类别加载不同的视图全局属性
    const loadViewProps = async (id: string, category: string) => {
        switch (category) {
            case 'basic':
                viewProps.value = await loadBasicViewProps(id)
                break
            case 'project':
                viewProps.value = await loadProjectViewProps(id)
                break
            case 'tag':
                viewProps.value = await loadTagViewProps(id)
                break
            default:
                viewProps.value = void 0
        }
    }

    // @methods 清单名称修改 - 通过 NuePrompt 进行
    const showProjectNameUpdater = (projectId: string) => {
        NuePrompt({
            title: '清单名称修改',
            placeholder: '请输入新的清单名称',
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            inputType: 'text',
            inputValue: projects.value.find((p) => p.id === projectId)?.name,
            validator: (value) => (value ? null : '清单名称不能为空'),
            onConfirm: async (value, done) => {
                const err = await projectStore.updateProject(projectId, { name: value as string })
                if (err) return unwrapError(err)
                NueMessage.success('清单名称修改成功')
                // 刷新视图参数
                if (!viewProps.value) return '失败'
                if (projectId === viewProps.value.id) {
                    viewProps.value.name = value as string
                    done()
                    return null
                }
                return '失败'
            }
        })
    }

    // @methods 清单描述修改 - 通过 NuePrompt 进行
    const showProjectDescriptionUpdater = (projectId: string) => {
        NuePrompt({
            title: '清单描述修改',
            placeholder: '请输入新的清单描述',
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            inputType: 'textarea',
            inputValue: projects.value.find((p) => p.id === projectId)?.description,
            validator: (value) => (value ? null : '清单描述不能为空'),
            onConfirm: async (value, done) => {
                const err = await projectStore.updateProject(projectId, {
                    description: value as string
                })
                if (err) return unwrapError(err)
                NueMessage.success('清单描述修改成功')
                // 刷新视图参数
                if (!viewProps.value) return '失败'
                if (projectId === viewProps.value.id) {
                    viewProps.value.description = value as string
                    done()
                    return null
                }
                return '失败'
            }
        })
    }

    // @methods 标签名称修改 - 通过 NuePrompt 进行
    const showTagNameUpdater = async (tagId: string) => {
        return await NuePrompt({
            title: '标签名称修改',
            placeholder: '请输入新的标签名称',
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            inputType: 'text',
            inputValue: tags.value.find((t) => t.id === tagId)?.name,
            validator: (value) => (value ? null : '标签名称不能为空'),
            onConfirm: async (value, done) => {
                const err = await tagStore.updateTag(tagId, { name: value as string })
                if (err) return unwrapError(err)
                NueMessage.success('标签名称修改成功')
                // 刷新视图参数
                if (!viewProps.value) return '失败'
                if (tagId === viewProps.value.id) {
                    viewProps.value.name = value as string
                    done()
                    return null
                }
                return '失败'
            }
        })
    }

    // @methods 标签描述修改 - 通过 NuePrompt 进行
    const showTagDescriptionUpdater = async (tagId: string) => {
        return await NuePrompt({
            title: '标签描述修改',
            placeholder: '请输入新的标签描述',
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            inputType: 'textarea',
            inputValue: tags.value.find((t) => t.id === tagId)?.description,
            validator: (value) => (value ? null : '标签描述不能为空'),
            onConfirm: async (value, done) => {
                const err = await tagStore.updateTag(tagId, { description: value as string })
                if (err) return unwrapError(err)
                NueMessage.success('标签描述修改成功')
                // 刷新视图参数
                if (!viewProps.value) return '失败'
                if (tagId === viewProps.value.id) {
                    viewProps.value.description = value as string
                    done()
                    return null
                }
                return '失败'
            }
        })
    }

    // @method 切换视图
    const switchView = (viewType: string) => {
        if (!viewProps.value) return
        viewProps.value.preference.viewType = viewType
    }

    // @method 切换隐藏已完成
    const hideCompleted = async () => {
        if (!viewProps.value) return
        viewProps.value.preference.getTodosOptions.state = 'todo,in-progress'
        await refreshData()
    }

    // @method 更新列选项
    const updateColumns = (columnKey: string) => {
        if (!viewProps.value) return
        const key = columnKey as keyof TodoColumnOptions
        viewProps.value.preference.columns[key] = !viewProps.value.preference.columns[key]
    }

    // @method 刷新数据
    const refreshData = async () => {
        if (!viewProps.value) return
        const err = await todoStore.regetTodos()
        if (err) {
            NueMessage.error(unwrapError(err))
            return
        }
    }

    // @method 更新基础分类视图偏好 - 由 更新视图偏好 调用
    const updateBasicPreference = (viewId: string, preference: ProjectPreference): Err => {
        try {
            const preferenceString = JSON.stringify(preference)
            localStorage.setItem(
                `${USER_TASKS_BASIC_VIEW_PREFERENCE_LSKEY}/${viewId}`,
                preferenceString
            )
        } catch (err: unknown) {
            console.warn(
                '[UseTasksViewStore/UpdateBasicPreference] Error:',
                unwrapError(err as Err)
            )
            return err as Err
        }
        return null
    }

    // @method 更新视图偏好
    const updatePreference = async () => {
        if (!viewProps.value) return
        // 获取属性
        const id = viewProps.value.id
        const category = viewProps.value.category
        const preference = viewProps.value.preference
        // 判断当前分类
        let err: Err = null
        // 调用 API 更新视图偏好
        switch (category) {
            case 'project':
                err = await projectStore.updateProjectPreference(id, preference)
                break
            case 'tag':
                err = await tagStore.updateTagPreference(id, preference)
                break
            case 'basic':
                err = updateBasicPreference(id, preference)
                break
            default:
                break
        }
        // 处理失败结果
        if (err) {
            NueMessage.error(unwrapError(err))
            return
        }
        NueMessage.success('视图偏好更新成功')
        return
    }

    // @method 获取列名文本
    const getColumnText = (key: string, replaceText?: string) => {
        const _k = key as keyof typeof columnTexts
        return columnTexts[_k] || replaceText || '无效列名'
    }

    // @returns
    return {
        // 侧边栏状态
        responsiveFlag,
        isUseFloatAside,
        isDisplayAside,
        isUseFloatOutline,
        switchIsDisplayAside,
        // 侧边栏宽度
        asideWidth: globalAsideWidth,
        outlineWidth: globalOutlineWidth,
        handleAsideResize: viewStore.handleAsideResize,
        handleOutlineResize: viewStore.handleOutlineResize,
        // 全局视图属性
        viewProps,
        viewPropsLoadState,
        loadViewProps,
        // project
        showProjectNameUpdater,
        showProjectDescriptionUpdater,
        // tag
        showTagNameUpdater,
        showTagDescriptionUpdater,
        // other handlers
        switchView,
        hideCompleted,
        updateColumns,
        refreshData,
        updatePreference,
        getColumnText,
        tasksAsideNavLinkVisible
    }
})

export default useTasksViewStore



