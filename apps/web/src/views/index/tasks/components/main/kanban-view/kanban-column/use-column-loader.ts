import { computed, ref, shallowReactive } from 'vue'
import { useTodoStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { getTodos } from '@nao-todo/apis'
import { useTasksHandlerStore } from '@/views/index/tasks/stores'
import { debounce } from '@nao-todo/utils'
import type { GetTodosOptions, GetTodosResponseData } from '@nao-todo/types'

const todoStore = useTodoStore()
const handlerStore = useTasksHandlerStore()

export const useColumnLoader = (name: string) => {
    const { todos, getOptions: originalGetOptions } = storeToRefs(todoStore)
    const pageInfo = shallowReactive({ page: 1, limit: 20 })
    const isLoading = ref(false)
    const isAllLoaded = ref(false)
    const isTheFirstLoading = ref(true)

    const isDisabled = computed(() => {
        const stateInOriginalGetOptions = originalGetOptions.value.state ?? ''
        return stateInOriginalGetOptions && !stateInOriginalGetOptions.includes(name)
    })

    const loadMore = async () => {
        if (isDisabled.value) return
        if (isLoading.value && isAllLoaded.value) return
        const getOptions: GetTodosOptions = {
            ...originalGetOptions.value,
            ...pageInfo,
            state: name
        }
        isLoading.value = true
        try {
            const response = await getTodos(getOptions)
            if (response.code === 20000) {
                const responseData = response.data as GetTodosResponseData
                todos.value.push(...responseData.todos)
                pageInfo.page += 1
                isAllLoaded.value = responseData.payload.countInfo.length < pageInfo.limit
                isTheFirstLoading.value = false
            }
        } catch (e) {
            console.error(
                '[UseColumnLoader/loadMore]',
                `Column '${name}' failed to loading more:`,
                e
            )
        } finally {
            setTimeout(() => (isLoading.value = false), 500)
        }
    }

    const resetAndLoad = async () => {
        pageInfo.page = 1
        isTheFirstLoading.value = true
        todoStore.deleteAllLocalTodos()
        await loadMore()
    }

    const debouncedLoadMore = debounce(resetAndLoad, 360)

    todoStore.$onAction(({ name: actionName, after }) => {
        if (actionName !== 'mergeGetOptions') return
        // console.log(name, actionName)
        after(debouncedLoadMore)
    })

    handlerStore.$onAction(({ name: actionName, after }) => {
        if (actionName !== 'handleRefresh') return
        after(debouncedLoadMore)
    })

    return {
        name,
        pageInfo,
        isLoading,
        isAllLoaded,
        isTheFirstLoading,
        isDisabled,
        loadMore: debounce(loadMore, 64)
    }
}
