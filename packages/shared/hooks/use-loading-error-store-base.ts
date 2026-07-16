import { ref } from 'vue'

/**
 * 加载错误存储基础
 * @state loading 加载态
 * @state error 错误信息
 * @method setLoading 设置加载态
 * @method setError 设置错误信息
 */
export const useLoadingErrorStoreBase = () => {
    // @state loading 加载态
    const loading = ref<boolean>(false)

    // @state error 错误信息
    const error = ref<string>('')

    // @method setLoading 设置加载态
    const setLoading = (newLoading: boolean) => {
        loading.value = newLoading
    }

    // @method setError 设置错误信息
    const setError = (newError: string) => {
        error.value = newError
    }

    // @return
    return { loading, error, setLoading, setError }
}

// @typedef LoadingErrorStoreBase 加载错误存储基础类型
export type LoadingErrorStoreBase = ReturnType<typeof useLoadingErrorStoreBase>
