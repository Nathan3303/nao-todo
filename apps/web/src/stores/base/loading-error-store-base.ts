import { ref } from 'vue'

const useLoadingErrorStoreBase = () => {
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
    return {
        loading,
        error,
        setLoading,
        setError
    }
}

export default useLoadingErrorStoreBase
export type LoadingErrorStoreBase = ReturnType<typeof useLoadingErrorStoreBase>
