import type { NaoSmartListLinkVO } from '@/components/ui'
import { TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { useBuiltInProjectsStore, useProjectsStore, useTagsStore } from '@/stores/tasks'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'
import { computed, inject, ref } from 'vue'

const useAside = () => {
    // @context Tasksview 任务视图上下文
    const tasksViewContext = inject<TasksViewContext>(TASKS_VIEW_CONTEXT_KEY)!

    // @dataStores
    const builtInProjectStore = useBuiltInProjectsStore()
    const projectStore = useProjectsStore()
    const tagStore = useTagsStore()

    // @state 侧边栏折叠项记录
    const collapseItemsRecord = ref(['projects', 'filters', 'tags'])

    // @state 侧边栏内建清单路由按钮视图对象
    const builtInProjectLinks = computed<NaoSmartListLinkVO[]>(() => {
        return [...builtInProjectStore.builtInProjects.values()].map((project) => ({
            id: project.id,
            title: project.name,
            route: { name: 'tasks-built-in-project', params: { projectId: project.id } },
            icon: project.icon
        }))
    })

    // @state 侧边栏清单路由按钮视图对象
    const projectLinks = computed<NaoSmartListLinkVO[]>(() => {
        return [...projectStore.projects.values()].map((p) => {
            return {
                id: p.id,
                title: p.name,
                route: { name: 'tasks-project', params: { projectId: p.id } },
                icon: p.icon || 'more2'
            }
        })
    })

    // @state 侧边栏标签路由按钮视图对象
    const tagLinks = computed<NaoSmartListLinkVO[]>(() => {
        return [...tagStore.tags.values()].map((tag) => ({
            id: tag.id,
            title: tag.name,
            route: { name: 'tasks-tag', params: { tagId: tag.id } },
            icon: 'tag',
            payload: { color: tag.color || 'default' }
        }))
    })

    // @method 打开对话框
    const openDialog = (dialogName: string) => {
        tasksViewContext.dialogManager.openDialog(dialogName)
    }

    // @return
    return {
        collapseItemsRecord,
        builtInProjectLinks,
        projectLinks,
        tagLinks,
        openDialog
    }
}

export default useAside
