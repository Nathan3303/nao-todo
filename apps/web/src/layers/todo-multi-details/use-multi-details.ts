import { computed, ref, watchEffect } from 'vue'
import { useProjectStore, useTagStore, useTodoStore, useUserStore } from '@/stores'
import { debounce } from '@nao-todo/utils'
import { useRoute, useRouter } from 'vue-router'
import { useTasksViewStore } from '@/views/index/tasks/stores'
import type { TodoMultiDetailsProps } from './types'
import type { Todo } from '@nao-todo/types'

export const useMultiDetails = (props: TodoMultiDetailsProps) => {
    const route = useRoute()
    const router = useRouter()
    const userStore = useUserStore()
    const projectStore = useProjectStore()
    const todoStore = useTodoStore()
    const tagStore = useTagStore()
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

    const endAt = ref<Todo['dueDate']['endAt']>(null)

    let updateOptions: Partial<Todo> = {}

    const avalibleProjects = computed(() => {
        return projectStore.findProjectsFromLocal({ isDeleted: false, isArchived: false })
    })

    const avalibleTags = computed(() => {
        return tagStore.tags
    })

    const getSelectedTodos = () => {
        const _selectedIds = [...props.selectedIds]
        const _selectedTodos: Todo[] = []
        for (const todo of todoStore.todos) {
            if (_selectedIds.length === 0) break
            const idx = _selectedIds.indexOf(todo.id)
            if (idx > -1) {
                _selectedIds.splice(idx, 1)
                _selectedTodos.push(todo)
            }
        }
        return _selectedTodos
    }

    const _updateTodos = async () => {
        const updateResult = await todoStore.doUpdateTodos(props.selectedIds, updateOptions)
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

    const handleRestore = async () => {
        const removeResult = await todoStore.restoreTodosWithConfirmation(props.selectedIds)
        if (!removeResult) return
        const prevRoute = route.matched[route.matched.length - 1]
        if (prevRoute) await router.push(prevRoute)
        tasksViewStore.hideMultiDetails()
    }

    const handleCancelMultiSelect = () => {
        // console.log('000');
        tasksViewStore.hideMultiDetails()
    }

    watchEffect(() => {
        const _selectedTodos = getSelectedTodos()
        const _commonData = {
            dueDate: { startAt: '', endAt: _selectedTodos[0].dueDate.endAt },
            priority: _selectedTodos[0].priority,
            state: _selectedTodos[0].state,
            projectId: _selectedTodos[0].projectId,
            project: _selectedTodos[0].project,
            tags: _selectedTodos[0].tags,
            isDeleted: _selectedTodos[0].isDeleted
        }
        const _commonDataCheckFlag = {
            dueDate: true,
            priority: true,
            state: true,
            projectId: true,
            tags: true,
            isDeleted: true
        }
        for (const todo of _selectedTodos) {
            if (_commonDataCheckFlag.dueDate && _commonData.dueDate.endAt !== todo.dueDate.endAt) {
                _commonData.dueDate = { startAt: '', endAt: '' }
                _commonDataCheckFlag.dueDate = false
            }
            if (_commonDataCheckFlag.priority && _commonData.priority !== todo.priority) {
                _commonData.priority = '' as Todo['priority']
                _commonDataCheckFlag.priority = false
            }
            if (_commonDataCheckFlag.state && _commonData.state !== todo.state) {
                _commonData.state = '' as Todo['state']
                _commonDataCheckFlag.state = false
            }
            if (_commonDataCheckFlag.projectId && _commonData.projectId !== todo.projectId) {
                _commonData.projectId = '' as Todo['projectId']
                _commonData.project = { title: '' }
                _commonDataCheckFlag.projectId = false
            }
            if (_commonDataCheckFlag.tags) {
                if (_commonData.tags.length === todo.tags.length) {
                    for (const tagId of _commonData.tags) {
                        if (!todo.tags.includes(tagId)) {
                            _commonData.tags = ['']
                            _commonDataCheckFlag.tags = false
                            break
                        }
                    }
                } else {
                    _commonData.tags = ['']
                    _commonDataCheckFlag.tags = false
                }
            }
            if (_commonDataCheckFlag.isDeleted && _commonData.isDeleted !== todo.isDeleted) {
                _commonData.isDeleted = false
                _commonDataCheckFlag.isDeleted = false
            }
        }
        commonData.value = _commonData as any
    })

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
        handleCancelMultiSelect
    }
}
