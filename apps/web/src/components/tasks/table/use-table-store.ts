import { ref, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { defineStore, storeToRefs } from 'pinia'
import { useTasksDataStore, useTasksViewStore } from '@/stores/tasks'
import { unwrapError } from '@nao-todo/utils'
import type { GetTodosSortOptions } from '@nao-todo/types'

const useTableStore = defineStore('TodoTableStore', () => {
    // @stores 全局 stores
    const tasksDataStore = useTasksDataStore()
    const tasksViewStore = useTasksViewStore()

    // @states 前置状态
    const { todos, pagination, tags } = storeToRefs(tasksDataStore)
    const { viewProps } = storeToRefs(tasksViewStore)

    // @state 分页页码
    const page = ref<number>(1)

    // @states 加载态以及加载失败错误信息
    const loading = ref<boolean>(false)
    const error = ref<string>('')

    // @method 加载待办任务数据
    const getTodos = async (useLoading: boolean = false): Promise<boolean> => {
        // 判断 viewProps 是否存在
        if (!viewProps.value) return false
        // 重置加载状态
        loading.value = useLoading && true
        // 调用 API 请求数据
        const err = await tasksDataStore.getTodos({
            page: page.value,
            limit: 20,
            ...viewProps.value.preference.getTodosOptions
        })
        loading.value = useLoading && false
        // 处理失败结果
        if (err) {
            error.value = unwrapError(err)
            return false
        }
        // 处理当待办任务为空时的情况
        if (todos.value.length === 0) {
            error.value = '暂无待办任务'
            return false
        }
        // 处理成功结果
        error.value = ''
        return true
    }

    // @returns
    return {
        todos,
        pagination,
        tags,
        loading,
        error,
        page,
        getTodos
    }
})

export default useTableStore
