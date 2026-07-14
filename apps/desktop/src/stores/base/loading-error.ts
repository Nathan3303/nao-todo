import { ref } from 'vue'

export const useLoadingErrorStoreBase = () => {
    // @state 加载态
    const loading = ref<boolean>(false)

    // @state 错误信息
    const error = ref<string>('')

    // @state 设置加载态
    const setLoading = (newLoading: boolean) => {
        loading.value = newLoading
    }

    // @state 设置错误信息
    const setError = (newError: string) => {
        error.value = newError
    }

    // @return
    return { loading, error, setLoading, setError }
}

export const useDualLoadingErrorStoreBase = () => {
    // @state Events 加载态
    const eventsLoading = ref<boolean>(false)

    // @state Events 错误信息
    const eventsError = ref<string>('')

    // @state Comments 加载态
    const commentsLoading = ref<boolean>(false)

    // @state Comments 错误信息
    const commentsError = ref<string>('')

    // @method 设置 Events 加载态
    const setEventsLoading = (newLoading: boolean) => {
        eventsLoading.value = newLoading
    }

    // @method 设置 Events 错误信息
    const setEventsError = (newError: string) => {
        eventsError.value = newError
    }

    // @method 设置 Comments 加载态
    const setCommentsLoading = (newLoading: boolean) => {
        commentsLoading.value = newLoading
    }

    // @method 设置 Comments 错误信息
    const setCommentsError = (newError: string) => {
        commentsError.value = newError
    }

    // @return
    return {
        eventsLoading,
        eventsError,
        commentsLoading,
        commentsError,
        setEventsLoading,
        setEventsError,
        setCommentsLoading,
        setCommentsError
    }
}

export type LoadingErrorStoreBase = ReturnType<typeof useLoadingErrorStoreBase>
export type DualLoadingErrorStoreBase = ReturnType<typeof useDualLoadingErrorStoreBase>

