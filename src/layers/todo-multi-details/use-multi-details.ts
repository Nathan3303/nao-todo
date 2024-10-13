import { computed, reactive, ref, watch, watchEffect } from 'vue'
import { useUserStore, useProjectStore, useTagStore, useTodoStore, type Todo } from '@/stores'
import { updateTodos } from '@/utils/todo-handlers'
import { debounce } from '@/utils'
import type { TodoMultiDetailsProps } from './types'

export const useMultiDetails = (props: TodoMultiDetailsProps) => {
    const userStore = useUserStore()
    const projectStore = useProjectStore()
    const todoStore = useTodoStore()
    const tagStore = useTagStore()

    const commonData = ref({
        dueDate: { startAt: '', endAt: '' },
        priority: '',
        state: '',
        projectId: '',
        project: { title: '' },
        tags: ['']
    })

    const priorityOptions = [
        { label: '低优先级', value: 'low' },
        { label: '中优先级', value: 'medium' },
        { label: '高优先级', value: 'high' }
    ]

    const stateOptions = [
        { label: '代办', value: 'todo' },
        { label: '正在进行', value: 'in-progress' },
        { label: '已完成', value: 'done' }
    ]

    let updateOptions: Partial<Todo> = {}

    const avalibleProjects = computed(() => {
        return projectStore._toFiltered({ isDeleted: false, isArchived: false })
    })

    const avalibleTags = computed(() => {
        return tagStore.tags
    })

    const endDate = computed({
        get() {
            if (!commonData.value.dueDate.endAt) return ''
            const sliced = commonData.value.dueDate.endAt!.slice(0, 16)
            return sliced
        },
        set(value) {
            commonData.value.dueDate.endAt = value
        }
    })

    const getSelectedTodos = () => {
        const _selectedIds = [...props.selectedIds]
        const _selectedTodos: Todo[] = []
        for (const todo of todoStore.todos) {
            const idx = _selectedIds.indexOf(todo.id)
            if (idx > -1) {
                _selectedIds.splice(idx, 1)
                _selectedTodos.push(todo)
            }
            if (_selectedIds.length === 0) break
        }
        return _selectedTodos
    }

    const debouncedUpdateTodos = debounce(async () => {
        const updateResult = await updateTodos(props.selectedIds, updateOptions)
        // console.log('[debouncedUpdateTodos]', updateResult)
        updateOptions = {}
    }, 1024)

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

    watchEffect(() => {
        const _selectedTodos = getSelectedTodos()
        const _commonData = {
            dueDate: _selectedTodos[0].dueDate,
            priority: _selectedTodos[0].priority,
            state: _selectedTodos[0].state,
            projectId: _selectedTodos[0].projectId,
            project: _selectedTodos[0].project,
            tags: _selectedTodos[0].tags
        }
        const _commonDataCheckFlag = {
            dueDate: true,
            priority: true,
            state: true,
            projectId: true,
            tags: true
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
        }
        commonData.value = _commonData as any
    })

    return {
        avalibleProjects,
        avalibleTags,
        commonData,
        endDate,
        userStore,
        priorityOptions,
        stateOptions,
        setProjectInfo,
        handleChangeEndDate,
        handleUpdateTags,
        handleChangeState,
        handleChangePriority
    }
}
