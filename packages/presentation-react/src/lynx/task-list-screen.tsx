import { useEffect, useMemo, useState } from '@lynx-js/react'
import { Button } from '@lynx-js/lynx-ui'
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
import { useSafeArea } from '../hooks/use-safe-area'
import { TaskCard } from './components/task-card'
import { ScreenHeader } from './components/screen-header'
import { OptionsSheet } from './components/options-sheet'
import './task-ui.css'
import './task-card.css'
import './task-list.css'

export type TaskListScreenProps = {
    app: TaskApp
    onOpenSidebar: () => void
}

/** 排序字段选项（对齐 Web TaskSortOperator 常用列） */
const SORT_FIELDS: Array<{ key: string; label: string }> = [
    { key: 'createdAt', label: 'task.column.createdAt' },
    { key: 'endAt', label: 'task.column.endAt' },
    { key: 'updatedAt', label: 'task.column.updatedAt' },
    { key: 'priority', label: 'task.column.priority' }
]

/**
 * 任务列表屏幕（默认落地页：「今日任务」）
 * @description 路由参数驱动（builtinId/projectId/tagId 三选一）；右上角排序/筛选/更多
 *              （对齐 Web filter-dropdown + operation-dropdown：sort/state/priority/隐藏已完成），
 *              请求参数与前端兜底过滤双保险。
 */
export const TaskListScreen = ({ app, onOpenSidebar }: TaskListScreenProps) => {
    const { t } = useI18n()
    const route = useNav()
    const { bottom: safeBottom } = useSafeArea()
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

    return (
        <view className="ts-screen">
            <ScreenHeader
                title={listTitle}
                left="menu"
                onLeftClick={onOpenSidebar}
                right={
                    <view className="tl-actions">
                        <Button
                            className={`tl-action-btn${sortSheetOpen ? ' ui-active' : ''}`}
                            onClick={() => setSortSheetOpen(true)}
                        >
                            <text className="tl-action-icon">↕</text>
                        </Button>
                        <Button
                            className={`tl-action-btn${filterSheetOpen ? ' ui-active' : ''}`}
                            onClick={() => setFilterSheetOpen(true)}
                        >
                            {hasFilter ? <view className="tl-action-dot" /> : null}
                            <text className="tl-action-icon">⏳</text>
                        </Button>
                        <Button
                            className={`tl-action-btn${moreSheetOpen ? ' ui-active' : ''}`}
                            onClick={() => setMoreSheetOpen(true)}
                        >
                            <text className="tl-action-icon">⋯</text>
                        </Button>
                    </view>
                }
            />
            <view className="ts-glow" />

            <view className="ts-screen-body">
                {loading ? (
                    <view className="ts-loading">
                        <text className="ts-loading-text">{t('mobile.taskList.loading')}</text>
                    </view>
                ) : loadFailed ? (
                    <view className="ts-empty">
                        <view className="ts-empty-mark">
                            <text className="ts-empty-mark-text">❧</text>
                        </view>
                        <text className="ts-empty-text">{t('mobile.common.loadFailed')}</text>
                    </view>
                ) : visibleTasks.length === 0 ? (
                    <view className="ts-empty">
                        <view className="ts-empty-mark">
                            <text className="ts-empty-mark-text">❧</text>
                        </view>
                        <text className="ts-empty-text">{t('mobile.taskList.empty')}</text>
                    </view>
                ) : (
                    <scroll-view className="ts-scroll" scroll-orientation="vertical">
                        <view className="ts-list">
                            {visibleTasks.map((task, index) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    tagNames={tagNames}
                                    style={{ animationDelay: `${Math.min(index * 45, 450)}ms` }}
                                    onClick={() => openDetail(task.id)}
                                />
                            ))}
                        </view>
                    </scroll-view>
                )}
            </view>

            <Button
                className="ts-fab"
                style={{ bottom: `${48 + safeBottom}rpx` }}
                onClick={openCreate}
            >
                <text className="ts-fab-text">+</text>
            </Button>

            {/* 排序 */}
            <OptionsSheet
                show={sortSheetOpen}
                title={t('mobile.taskList.sort')}
                sections={[
                    {
                        title: t('mobile.taskList.sortField'),
                        options: SORT_FIELDS.map((item) => ({
                            key: item.key,
                            label: t(item.label as LocaleKey)
                        })),
                        selectedKey: sortDraft.field,
                        onSelect: (key) =>
                            setSortDraft((prev) => ({
                                ...prev,
                                field: key as TaskSortOptions['field']
                            }))
                    },
                    {
                        title: t('mobile.taskList.sortOrder'),
                        options: [
                            { key: 'asc', label: t('mobile.taskList.sortAsc') },
                            { key: 'desc', label: t('mobile.taskList.sortDesc') }
                        ],
                        selectedKey: sortDraft.order,
                        onSelect: (key) =>
                            setSortDraft((prev) => ({
                                ...prev,
                                order: key as TaskSortOptions['order']
                            }))
                    }
                ]}
                confirmText={t('common.confirm')}
                onConfirm={() => {
                    setSort(sortDraft)
                    setSortSheetOpen(false)
                }}
                onCancel={() => {
                    setSortDraft(sort)
                    setSortSheetOpen(false)
                }}
            />

            {/* 筛选 */}
            <OptionsSheet
                show={filterSheetOpen}
                title={t('mobile.taskList.filter')}
                sections={[
                    {
                        title: t('mobile.taskCreate.state'),
                        options: [
                            { key: '', label: t('mobile.taskList.filterAll') },
                            { key: 'todo', label: t('task.state.todo') },
                            { key: 'in-progress', label: t('task.state.inProgress') },
                            { key: 'done', label: t('task.state.done') }
                        ],
                        selectedKey: stateFilterDraft,
                        onSelect: setStateFilterDraft
                    },
                    {
                        title: t('mobile.taskCreate.priority'),
                        options: [
                            { key: '', label: t('mobile.taskList.filterAll') },
                            { key: 'high', label: t('task.priority.high') },
                            { key: 'medium', label: t('task.priority.medium') },
                            { key: 'low', label: t('task.priority.low') },
                            { key: 'none', label: t('task.priority.none') }
                        ],
                        selectedKey: priorityFilterDraft,
                        onSelect: setPriorityFilterDraft
                    }
                ]}
                confirmText={t('common.confirm')}
                onConfirm={() => {
                    setStateFilter(stateFilterDraft)
                    setPriorityFilter(priorityFilterDraft)
                    setFilterSheetOpen(false)
                }}
                onCancel={() => {
                    setStateFilterDraft(stateFilter)
                    setPriorityFilterDraft(priorityFilter)
                    setFilterSheetOpen(false)
                }}
            />

            {/* 更多 */}
            <OptionsSheet
                show={moreSheetOpen}
                title={t('mobile.taskList.more')}
                actions={[
                    {
                        key: 'refresh',
                        label: t('mobile.taskList.refresh'),
                        onPress: () => {
                            setMoreSheetOpen(false)
                            setReloadKey((key) => key + 1)
                        }
                    },
                    {
                        key: 'hide-completed',
                        label: hideCompleted
                            ? t('mobile.taskList.showCompleted')
                            : t('mobile.taskList.hideCompleted'),
                        checked: hideCompleted,
                        onPress: () => {
                            setHideCompleted((prev) => !prev)
                            setMoreSheetOpen(false)
                        }
                    }
                ]}
                onCancel={() => setMoreSheetOpen(false)}
            />
        </view>
    )
}