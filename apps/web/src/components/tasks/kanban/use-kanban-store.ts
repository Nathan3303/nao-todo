import { ref } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { useTodoStore } from '@/stores/global'
import { useTasksDataStore } from '@/stores/tasks'

// @constants
const KANBAN_STATES = ['todo', 'in-progress', 'done']
const KANBAN_PRIORITY = ['high', 'medium', 'low']

const useKanbanStore = defineStore('TodoKanbanStore', () => {
    // @stores 全局 stores
    const todoStore = useTodoStore()
    const tasksDataStore = useTasksDataStore()

    // @states 前置状态
    const { todos, tags, projects } = storeToRefs(tasksDataStore)

    // @state 看板分组列表
    const kanbanColumns = ref<string[]>([])

    // @method 获取分组列表
    const getKanbanColumns = (groupBy: string = 'state') => {
        loading.value = true
        switch (groupBy) {
            case 'priority':
                kanbanColumns.value = KANBAN_PRIORITY
                break
            case 'state':
                kanbanColumns.value = KANBAN_STATES
                break
            default:
                kanbanColumns.value = []
                break
        }
        loading.value = false
    }

    // @state 加载状态
    const loading = ref(true)

    // @method 从本地项目列表中获取项目名称
    const getProjectNameByIdFromLocal = (projectId: string) => {
        const targetProject = projects.value.find((p) => p.id === projectId)
        return targetProject ? targetProject.name : '收集箱'
    }

    // @returns
    return {
        loading,
        kanbanColumns,
        todos,
        tags,
        getKanbanColumns,
        getProjectNameByIdFromLocal,
        getTodosWithPush: todoStore.getTodosWithPush
    }
})

export default useKanbanStore
