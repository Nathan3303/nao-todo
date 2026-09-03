import { useEffect, useMemo, useState } from '@lynx-js/react'
import type { LocaleKey } from '@nao-todo/shared/locales/types'
import { useBuiltInProjectStore } from '../hooks/use-built-in-project-store'
import { useI18n } from '../hooks/use-i18n'
import { useNav } from '../hooks/use-nav'
import { useProjectStore } from '../hooks/use-project-store'
import { useTagStore } from '../hooks/use-tag-store'
import { useTaskStore } from '../hooks/use-task-store'
import { navCore } from '../logic/nav-core'
import {
    filterTasksByStatePriority,
    filterTasksByView,
    getBuiltInListTasksOptions,
    getProjectListTasksOptions,
    getSortedTasks,
    getTagListTasksOptions,
    mergeListOptions,
    type TaskSortOptions
} from '../logic/task-filter-core'
import type { TaskApp } from '../hooks/use-task-app'

/**
 * 任务列表屏幕逻辑 hook（屏幕渲染与业务交互分离）
 * @description 收敛清单数据加载/排序/筛选/更多面板的全部状态与副作用；
 *              组件只读返回值渲染，JSX 不再内联业务编排（DDD 红线）。
 * @param app 任务应用组合根（useTaskApp 返回值）
 */
export const useTaskListScreen = (app: TaskApp) => {
    const { t } = useI18n()
    const route = useNav()
    const { tasks } = useTaskStore(app.taskStore)
    const { builtInProjects } = useBuiltInProjectStore(app.builtInProjectStore)
    const { projects } = useProjectStore(app.projectStore)
    const { tags } = useTagStore(app.tagStore)
    const [loading, setLoading] = useState(true)
    const [loadFailed, setLoadFailed] = useState(false)
    const [reloadKey, setReloadKey] = useState(0)

    // 排序/筛选/更多状态
    const [sort, setSort] = useState<TaskSortOptions>({ field: 'createdAt', order: 'desc' })
    const [sortDraft, setSortDraft] = useState<TaskSortOptions>(sort)
    const [stateFilter, setStateFilter] = useState('')
    const [stateFilterDraft, setStateFilterDraft] = useState('')
    const [priorityFilter, setPriorityFilter] = useState('')
    const [priorityFilterDraft, setPriorityFilterDraft] = useState('')
    const [hideCompleted, setHideCompleted] = useState(false)
    const [sortSheetOpen, setSortSheetOpen] = useState(false)
    const [filterSheetOpen, setFilterSheetOpen] = useState(false)
    const [moreSheetOpen, setMoreSheetOpen] = useState(false)

    const { builtinId, projectId, tagId } = route.params

    // 首屏/清单切换：拉取任务 + 初始化项目/标签（侧边栏与创建页共用）
    useEffect(() => {
        void app.projectUseCase.loadProjects()
        void app.tagUseCase.loadTags()
    }, [app.projectUseCase, app.tagUseCase])

    // 清单/排序/筛选/刷新：拉取列表（请求参数与前端兜底双保险）
    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setLoadFailed(false)
        const baseOptions = builtinId
            ? getBuiltInListTasksOptions(builtinId)
            : projectId
              ? getProjectListTasksOptions(projectId)
              : tagId
                ? getTagListTasksOptions(tagId)
                : getBuiltInListTasksOptions('today')
        const options = mergeListOptions(baseOptions, {
            sort,
            state: stateFilter,
            priority: priorityFilter,
            isHideCompleted: hideCompleted
        })
        void (async () => {
            const [, err] = await app.taskUseCase.listTasks(options)
            if (cancelled) return
            setLoading(false)
            if (err !== null) setLoadFailed(true)
        })()
        return () => {
            cancelled = true
        }
    }, [
        app.taskUseCase,
        builtinId,
        projectId,
        tagId,
        sort,
        stateFilter,
        priorityFilter,
        hideCompleted,
        reloadKey
    ])

    const listTitle = useMemo(() => {
        if (builtinId) {
            const found = builtInProjects.find((p) => p.id === builtinId)
            if (found) return found.name
            return t(`builtin.${builtinId}` as LocaleKey)
        }
        if (projectId) {
            return projects.find((p) => p.id === projectId)?.name ?? t('common.unknown')
        }
        if (tagId) {
            return tags.find((tag) => tag.id === tagId)?.name ?? t('common.unknown')
        }
        return t('builtin.today')
    }, [builtinId, projectId, tagId, builtInProjects, projects, tags, t])

    const tagNames = useMemo(() => {
        const map = new Map(tags.map((tag) => [tag.id, tag.name]))
        return (tagId: string): string => map.get(tagId) ?? ''
    }, [tags])

    // 前端兜底：视图过滤 → 隐藏已完成 → 状态/优先级 → 排序（请求参数同步，幂等）
    const visibleTasks = useMemo(() => {
        const byView = filterTasksByView(tasks, route.params)
        const notDone = hideCompleted ? byView.filter((task) => task.state !== 'done') : byView
        const byStatePriority = filterTasksByStatePriority(notDone, stateFilter, priorityFilter)
        return getSortedTasks(byStatePriority, sort)
    }, [tasks, route.params, hideCompleted, stateFilter, priorityFilter, sort])

    // 筛选计数（状态/优先级任一启用）
    const hasFilter = stateFilter !== '' || priorityFilter !== ''

    const openCreate = () => {
        navCore.push('task-create', { builtinId, projectId, tagId })
    }

    const openDetail = (taskId: string) => {
        navCore.push('task-detail', { taskId })
    }

    return {
        loading,
        loadFailed,
        visibleTasks,
        listTitle,
        tagNames,
        hasFilter,
        // 排序/筛选/更多面板状态
        sort,
        setSort,
        stateFilter,
        setStateFilter,
        priorityFilter,
        setPriorityFilter,
        hideCompleted,
        sortDraft,
        setSortDraft,
        stateFilterDraft,
        setStateFilterDraft,
        priorityFilterDraft,
        setPriorityFilterDraft,
        sortSheetOpen,
        setSortSheetOpen,
        filterSheetOpen,
        setFilterSheetOpen,
        moreSheetOpen,
        setMoreSheetOpen,
        setReloadKey,
        setHideCompleted,
        openCreate,
        openDetail
    }
}

export type TaskListLogic = ReturnType<typeof useTaskListScreen>