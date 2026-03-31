import { computed, inject, ref, watch } from 'vue'
import { useProjectsStore, useTagsStore, useTasksStore } from '@/stores/tasks'
import { useUserStore } from '@/stores'
import { debounce } from '@nao-todo/infrastructure/utils'
import { useRoute, useRouter } from 'vue-router'
import { useTasksViewStore } from '@/views/index/tasks'
import type { TaskMultiDetailsProps } from './types'
import type { TaskViewObject } from '@nao-todo/types'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'
import { TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'

export const useMultiDetails = (props: TaskMultiDetailsProps) => {
    // @viewContext TasksView context
    const tasksViewContext = inject<TasksViewContext>(TASKS_VIEW_CONTEXT_KEY)!
    const router = useRouter()
    const route = useRoute()

    // @stores
    const userStore = useUserStore()
    const projectStore = useProjectsStore()
    const taskStore = useTasksStore()
    const tagStore = useTagsStore()
    const tasksViewStore = useTasksViewStore()

    const commonData = ref({
        dueDate: { startAt: '', endAt: '' },
        priority: '',
        state: '',
        projectId: '',
        project: { title: '' },
        tags: [''],
        isDeleted: false
    })

    const endAt = ref<TaskViewObject['endAt']>('')

    let updateOptions: Partial<TaskViewObject> = {}

    const avalibleProjects = computed(() => {
        return projectStore.availableProjects.filter((project) => !project.isArchived)
    })

    const avalibleTags = computed(() => {
        return tagStore.tags
    })

    const getSelectedTasks = () => {
        const _selectedIds = [...props.selectedIds]
        if (!_selectedIds.length) return [] as TaskViewObject[]
        const _selectedTasks: TaskViewObject[] = []
        for (const task of taskStore.list) {
            if (_selectedIds.length === 0) break
            const idx = _selectedIds.indexOf(task.id)
            if (idx > -1) {
                _selectedIds.splice(idx, 1)
                _selectedTasks.push(task)
            }
        }
        return _selectedTasks
    }

    const _updateTasks = async () => {
        const updateResult = await taskStore.doUpdateTasks(props.selectedIds, updateOptions)
        if (
            updateResult &&
            Object.prototype.hasOwnProperty.call(updateOptions, 'projectId') &&
            updateOptions.projectId !== (route.params.projectId as string)
        ) {
            await todoStore.doGetTodos()
            const prevRoute = route.matched[route.matched.length - 1]
            if (prevRoute) await router.push(prevRoute)
            tasksViewStore.hideMultiDetails()
        }
        updateOptions = {}
    }

    const debouncedUpdateTodos = debounce(_updateTodos, 1024)

    const insertOptionsAndUpdate = (options: Partial<Todo>) => {
        Object.assign(updateOptions, options)
        debouncedUpdateTodos()
    }

    const setProjectInfo = (projectId: string, projectTitle: string) => {
        commonData.value.projectId = projectId
        commonData.value.project.title = projectTitle
        insertOptionsAndUpdate({ projectId, project: { title: projectTitle } })
    }

    const handleChangeEndDate = (date: string | null) => {
        insertOptionsAndUpdate({ dueDate: { startAt: null, endAt: date } })
    }

    const handleChangeState = (value: unknown) => {
        commonData.value.state = value as string
        insertOptionsAndUpdate({ state: value as Todo['state'] })
    }

    const handleChangePriority = (value: unknown) => {
        commonData.value.priority = value as string
        insertOptionsAndUpdate({ priority: value as Todo['priority'] })
    }

    const handleUpdateTags = (tags: string[]) => {
        commonData.value.tags = tags
        insertOptionsAndUpdate({ tags })
    }

    const handleRemove = async () => {
        const removeResult = await todoStore.deleteTodosWithConfirmation(props.selectedIds)
        if (!removeResult) return
        const prevRoute = route.matched[route.matched.length - 1]
        if (prevRoute) await router.push(prevRoute)
        tasksViewStore.hideMultiDetails()
    }

    const handleDelete = async () => {
        const removeResult = await todoStore.deleteTodosPermanentlyWithConfirmation(
            props.selectedIds
        )
        if (!removeResult) return
        const prevRoute = route.matched[route.matched.length - 1]
        if (prevRoute) await router.push(prevRoute)
        tasksViewStore.hideMultiDetails()
    }

    const handleRestore = async () => {
        const removeResult = await todoStore.restoreTodosWithConfirmation(props.selectedIds)
        if (!removeResult) return
        tasksViewStore.hideMultiDetails()
        const prevRoute = route.matched[route.matched.length - 1]
        if (prevRoute) await router.push(prevRoute)
    }

    const handleCancelMultiSelect = () => {
        // console.log('000');
        tasksViewStore.hideMultiDetails()
    }

    // 属性匹配检查
    const checkTodosAttrs = (
        target: Todo[],
        chkList: {
            attrName: string
            initValue: unknown
        }
    ) => {
        const _commonData = { ...target[0] }
        const _commonDataChkFlag = {
            dueDate: true,
            priority: true,
            state: true,
            projectId: true,
            tags: true,
            isDeleted: true
        }
        for (const todo of target) {
            for (const chkItem of chkList) {
                if (!_commonDataChkFlag[chkItem.attrName]) continue
                if (!Object.prototype.hasOwnProperty.call(todo, chkItem.attrName)) {
                    _commonData[chkItem.attrName] = chkItem.initValue
                    _commonDataChkFlag[chkItem.attrName] = false
                    continue
                }
                if (!chkItem.validator(_commonData[chkItem.attrName], todo[chkItem.attrName])) {
                    _commonData[chkItem.attrName] = chkItem.initValue
                    _commonDataChkFlag[chkItem.attrName] = false
                    // console.log('Attribute', chkItem.attrName, 'is different')
                }
            }
        }
        return _commonData
    }

    watch(
        () => props.selectedIds,
        () => {
            const _selectedTodos = getSelectedTodos()
            if (!_selectedTodos) return
            commonData.value = checkTodosAttrs(_selectedTodos, [
                {
                    attrName: 'dueDate',
                    initValue: { startAt: '', endAt: '' },
                    validator: (a, b) => a.endAt === b.endAt
                },
                {
                    attrName: 'state',
                    initValue: '',
                    validator: (a, b) => a === b
                },
                {
                    attrName: 'priority',
                    initValue: '',
                    validator: (a, b) => a === b
                },
                {
                    attrName: 'tags',
                    initValue: [],
                    validator: (a, b) => {
                        if (a.length !== b.length) return false
                        for (const tagId of a) {
                            if (!b.includes(tagId)) return false
                        }
                        return true
                    }
                },
                {
                    attrName: 'isDeleted',
                    initValue: false,
                    validator: (a, b) => a === b
                },
                {
                    attrName: 'projectId',
                    initValue: '',
                    validator: (a, b) => a === b
                }
            ])
        },
        { immediate: true, deep: true }
    )

    return {
        avalibleProjects,
        avalibleTags,
        commonData,
        endAt,
        userStore,
        setProjectInfo,
        handleChangeEndDate,
        handleUpdateTags,
        handleChangeState,
        handleChangePriority,
        handleRemove,
        handleRestore,
        handleDelete,
        handleCancelMultiSelect
    }
}




