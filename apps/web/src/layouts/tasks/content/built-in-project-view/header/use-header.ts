import { useTasksViewStore, useTasksDialogStore } from '@/views/tasks'
import { computed, inject, provide, type ComputedRef } from 'vue'
import { type TasksProjectViewContext, TASKS_PROJECT_VIEW_CONTEXT_KEY } from '../use-project-view'
import type { InnerDropdownOptionVO } from '@/components/ui'
import type { ProjectPreferenceVO, TodoColumnOptions, WithNull } from '@nao-todo/types'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

export type TasksProjectViewHeaderContext = {
    preference: ComputedRef<WithNull<ProjectPreferenceVO>>
    columnsDropdownOptions: ComputedRef<{ options: InnerDropdownOptionVO[]; count: number }>
    switchViewTypeToTable: () => void
    switchViewTypeToKanban: () => void
    switchViewTypeToList: () => void
    savePreference: () => void
    getColumnText: (key: string) => string
}

export const TASKS_PROJECT_VIEW_HEADER_CONTEXT_KEY = 'TASKS_PROJECT_VIEW_HEADER_CONTEXT_KEY'

export default () => {
    const router = useRouter()
    const tasksViewStore = useTasksViewStore()
    const tasksDialogStore = useTasksDialogStore()
    const viewContext = inject<TasksProjectViewContext>(TASKS_PROJECT_VIEW_CONTEXT_KEY)!

    // @states
    const { isDisplayAside } = storeToRefs(tasksViewStore)

    // @computed 现实与隐藏列的下拉列表选项
    const columnsDropdownOptions = computed(() => {
        const _fields: InnerDropdownOptionVO[] = []
        let count = 0
        if (viewContext) {
            const columnOptions = viewContext.preference.value!.columns
            Object.keys(columnOptions).forEach((key) => {
                const isChecked = columnOptions[key as keyof TodoColumnOptions]
                if (isChecked) count++
                _fields.push({
                    icon: 'plus-circle',
                    label: tasksViewStore.getColumnLabel(key),
                    value: key,
                    checked: isChecked
                })
            })
        }
        return { options: _fields, count }
    })

    // @method 视图切换
    const switchViewType = async (viewType: string) => {
        if (!viewType) return
        const err = await router.push({
            name: router.currentRoute.value.name,
            params: { viewType }
        })
        if (err) {
            console.error(err)
        }
    }

    // @method 切换侧边栏显示状态
    const switchAsideDisplay = () => {
        isDisplayAside.value = !isDisplayAside.value
    }

    // @method 显示创建任务对话框
    const openTaskCreator = () => {
        if (!tasksDialogStore.todoCreator) return
        tasksDialogStore.todoCreator.open?.({
            projectId: viewContext!.project.value!.id
        })
    }

    // @provide
    provide<TasksProjectViewHeaderContext>(TASKS_PROJECT_VIEW_HEADER_CONTEXT_KEY, {
        preference: viewContext?.preference,
        columnsDropdownOptions,
        switchViewTypeToTable: () => switchViewType('table'),
        switchViewTypeToKanban: () => switchViewType('kanban'),
        switchViewTypeToList: () => switchViewType('list'),
        savePreference: () => viewContext?.savePreference?.(),
        getColumnText: (key: string) => tasksViewStore.getColumnLabel(key)
    })

    return {
        isDisplayAside,
        switchAsideDisplay,
        openTaskCreator
    }
}
