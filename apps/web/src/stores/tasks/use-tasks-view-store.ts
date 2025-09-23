import { ref, shallowRef } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { basicViewProps } from '@/layouts/tasks'
import { useProjectStore, useTagStore } from '@/stores/global'
import { NuePrompt } from 'nue-ui'
import { useWindowResizeListener } from '@nao-todo/hooks'
import { type TasksMainViewProps, toProjectViewProps, toTagViewProps } from '@/layouts/tasks/'

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

    // @state 视图全局属性
    const viewProps = shallowRef<TasksMainViewProps | null>(null)

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
        viewProps.value = _viewProps ?? basicViewProps.find((vp) => vp.id === 'all')!
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
                return await projectStore.updateProject(projectId, { name: value as string })
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
                return await projectStore.updateProject(projectId, { description: value as string })
            }
        })
    }

    // @methods 标签名称和描述修改
    const showTagNameUpdater = (tagId: string) => {
        NuePrompt({
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
    const showTagDescriptionUpdater = (tagId: string) => {
        NuePrompt({
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
        responsiveFlag
    }
})

export default useTasksViewStore
