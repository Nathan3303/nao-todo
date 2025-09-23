import { useTasksDataStore } from '@/stores/tasks'
import type { Project } from '@nao-todo/types'
import { storeToRefs } from 'pinia'

type FilterHandler = (project: Project) => boolean
type FilterFunc = (...handlers: FilterHandler[]) => Project[]

const useProjectsFilter = () => {
    const tasksDataStore = useTasksDataStore()

    const { projects } = storeToRefs(tasksDataStore)

    const filter: FilterFunc = (...handlers) => {
        return projects.value.filter((project) => {
            return handlers.every((handler) => handler(project))
        }) as Project[]
    }

    return {
        filter
    }
}

export default useProjectsFilter
