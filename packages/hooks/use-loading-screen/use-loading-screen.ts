import { ref } from 'vue'

const loading = ref(false)

const useLoadingScreen = () => {
    const startLoading = () => (loading.value = true)

    const stopLoading = () => {
        requestIdleCallback(() => {
            loading.value = false
        })
    }

    return { loading, startLoading, stopLoading }
}

export default useLoadingScreen
