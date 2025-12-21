import { useTasksViewStore } from '@/views/tasks'
import { computed, inject, type ComputedRef } from 'vue'
import { type TasksProjectViewContext, TASKS_PROJECT_VIEW_CONTEXT_KEY } from '../use-project-view'
import type { InnerDropdownOptionVO } from '@/components/ui'
import type { TodoColumnOptions } from '@nao-todo/types'
import { useRouter } from 'vue-router'

export type TasksProjectViewHeaderContext = {
    columnsDropdownOptions: ComputedRef<{ options: InnerDropdownOptionVO[]; count: number }>
    switchViewTypeToTable: () => void
    switchViewTypeToKanban: () => void
    switchViewTypeToList: () => void
    savePreference: () => void
}

export default () => {
    const router = useRouter()
    const tasksViewStore = useTasksViewStore()
    const viewContext = inject<TasksProjectViewContext>(TASKS_PROJECT_VIEW_CONTEXT_KEY)

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

    // @provide

    return {
        viewContext,
        columnsDropdownOptions,
        switchViewTypeToTable: () => switchViewType('table'),
        switchViewTypeToKanban: () => switchViewType('kanban'),
        switchViewTypeToList: () => switchViewType('list'),
        savePreference: () => viewContext?.savePreference?.()
    }
}
