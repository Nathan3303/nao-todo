import { useTasksDataStore } from '@/stores/tasks'
import type { Tag } from '@nao-todo/types'
import { storeToRefs } from 'pinia'

type FilterHandler = (tag: Tag) => boolean
type FilterFunc = (...handlers: FilterHandler[]) => Tag[]

const useTagsFilter = () => {
    const tasksDataStore = useTasksDataStore()

    const { tags } = storeToRefs(tasksDataStore)

    const filter: FilterFunc = (...handlers) => {
        return tags.value.filter((tag) => {
            return handlers.every((handler) => handler(tag))
        }) as Tag[]
    }

    return {
        filter
    }
}

export default useTagsFilter
