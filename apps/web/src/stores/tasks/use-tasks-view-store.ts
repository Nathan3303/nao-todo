import { ref } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { basicViewProps } from '@/layouts/tasks'
import { useProjectStore, useTagStore, useTodoStore } from '@/stores/global'
import { NuePrompt, NueMessage } from 'nue-ui'
import { useWindowResizeListener } from '@nao-todo/hooks'
import { unwrapError } from '@nao-todo/utils'
import { type TasksMainViewProps, toProjectViewProps, toTagViewProps } from '@/layouts/tasks/'
import type { Err, TodoColumnOptions } from '@nao-todo/types'

const useTasksViewStore = defineStore('TasksViewStore', () => {
    // @states 读取侧边栏宽度记录
    const asideWidth = ref(localStorage.getItem('TASKS_ASIDE_WIDTH') || '256px')
    const outlineWidth = ref(localStorage.getItem('TASKS_OUTLINE_WIDTH') || '420px')

    // @methods 写入侧边栏宽度记录 - 当侧边栏宽度手动修改时调用
    const handleAsideResize = (newWidth: number) => {
        localStorage.setItem('TASKS_ASIDE_WIDTH', newWidth + 'px')
    }
    const handleOutlineResize = (newWidth: number) => {
        localStorage.setItem('TASKS_OUTLINE_WIDTH', newWidth + 'px')
    }

    // @states 全局 Store
    const projectStore = useProjectStore()
    const { projects } = storeToRefs(projectStore)
    const tagStore = useTagStore()
    const { tags } = storeToRefs(tagStore)
    const todoStore = useTodoStore()

    // @state 视图全局属性
    const viewProps = ref<TasksMainViewProps>()

    // @methods 加载视图全局属性
    const loadProjectViewProps = async (id: string): Promise<TasksMainViewProps | undefined> => {
        const project = projects.value.find((p) => p.id === id)
        if (!project) return
        return toProjectViewProps(project)
    }
    const loadTagViewProps = async (id: string): Promise<TasksMainViewProps | undefined> => {
        const tag = tags.value.find((t) => t.id === id)
        if (!tag) return
        return toTagViewProps(tag)
    }
    const loadViewProps = async (id: string, category: string) => {
        category = category || 'basic'
        let _viewProps: undefined | TasksMainViewProps
        switch (category) {
            case 'basic':
                _viewProps = basicViewProps.find((vp) => vp.id === id)
                break
            case 'project':
                _viewProps = await loadProjectViewProps(id)
                break
            case 'tag':
                _viewProps = await loadTagViewProps(id)
                break
        }
        // 如果获取的视图参数为空，则直接 void 0，使页面渲染错误
        if (!_viewProps) {
            viewProps.value = void 0
            return
        }
        // debug
        // console.log('[TasksViewStore/LoadViewProps]', _viewProps)
        // 更新 viewProps value
        viewProps.value = _viewProps
    }

    // @methods 清单名称和描述修改
    const showProjectNameUpdater = (projectId: string) => {
        NuePrompt({
            title: '清单名称修改',
            placeholder: '请输入新的清单名称',
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            inputType: 'text',
            inputValue: projects.value.find((p) => p.id === projectId)?.name,
            validator: (value) => !!value,
            onConfirm: async (value) => {
                const err = await projectStore.updateProject(projectId, { name: value as string })
                if (err) return unwrapError(err)
                NueMessage.success('清单名称修改成功')
                // 刷新视图参数
                if (!viewProps.value) return
                if (projectId === viewProps.value.id) viewProps.value.name = value as string
            }
        })
    }
    const showProjectDescriptionUpdater = (projectId: string) => {
        NuePrompt({
            title: '清单描述修改',
            placeholder: '请输入新的清单描述',
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            inputType: 'textarea',
            inputValue: projects.value.find((p) => p.id === projectId)?.description,
            validator: (value) => !!value,
            onConfirm: async (value) => {
                const err = await projectStore.updateProject(projectId, {
                    description: value as string
                })
                if (err) return unwrapError(err)
                NueMessage.success('清单描述修改成功')
                // 刷新视图参数
                if (!viewProps.value) return
                if (projectId === viewProps.value.id) viewProps.value.description = value as string
            }
        })
    }

    // @methods 标签名称和描述修改
    const showTagNameUpdater = async (tagId: string) => {
        return await NuePrompt({
            title: '标签名称修改',
            placeholder: '请输入新的标签名称',
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            inputType: 'text',
            inputValue: tags.value.find((t) => t.id === tagId)?.name,
            validator: (value) => !!value,
            onConfirm: async (value) => {
                return await tagStore.updateTag(tagId, { name: value as string })
            }
        })
    }
    const showTagDescriptionUpdater = async (tagId: string) => {
        return await NuePrompt({
            title: '标签描述修改',
            placeholder: '请输入新的标签描述',
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            inputType: 'textarea',
            inputValue: tags.value.find((t) => t.id === tagId)?.description,
            validator: (value) => !!value,
            onConfirm: async (value) => {
                return await tagStore.updateTag(tagId, { description: value as string })
            }
        })
    }

    // @states 响应式标记 -  0: 移动端 | 1-2: 移动端 (平板) | 3-4: 桌面端 | 5: 桌面端 (大屏) | 6: 电视
    const responsiveFlag = ref<number>(2)
    const responsiveWidths = [445, 800, 1200, 1600, 1920, 2560, 3840]
    const { addCallback: addWindowResizeCb } = useWindowResizeListener()

    // @methods 响应式检测 - 通过 window.innerWidth 和 window.resize 检测
    const responsiveFlagUpdater = () => {
        const innerWidth = window.innerWidth
        if (isNaN(innerWidth)) return
        const startAt = Math.min(Math.floor(innerWidth / 445), 5)
        for (let i = startAt; i < responsiveWidths.length; i++) {
            if (innerWidth > responsiveWidths[i]) continue
            responsiveFlag.value = i
            break
        }
    }
    addWindowResizeCb(responsiveFlagUpdater, true)

    // @methods 切换视图 / 隐藏已完成 / 更新列选项
    const switchView = (viewType: string) => {
        if (!viewProps.value) return
        viewProps.value.preference.viewType = viewType
    }
    const hideCompleted = async () => {
        if (!viewProps.value) return
        viewProps.value.preference.getTodosOptions.state = 'todo,in-progress'
        await refreshData()
    }
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

    // @method 更新视图偏好
    const updatePreference = async () => {
        if (!viewProps.value) return
        // ---
        console.log('updatePreference', viewProps.value.preference)
        // 获取属性
        const id = viewProps.value.id
        const category = viewProps.value.category
        const preference = viewProps.value.preference
        // 判断当前分类
        let err: Err = null
        switch (category) {
            case 'project':
                // 调用 API 更新视图偏好
                err = await projectStore.updateProjectPreference(id, preference)
                break
            case 'tag':
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

    // @returns
    return {
        asideWidth,
        outlineWidth,
        handleAsideResize,
        handleOutlineResize,
        viewProps,
        loadViewProps,
        showProjectNameUpdater,
        showProjectDescriptionUpdater,
        showTagNameUpdater,
        showTagDescriptionUpdater,
        responsiveFlag,
        switchView,
        hideCompleted,
        updateColumns,
        refreshData,
        updatePreference
    }
})

export default useTasksViewStore
