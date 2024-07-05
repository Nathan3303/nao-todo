import { ref } from 'vue'

const loading = ref(false)

export function useLoadingScreen() {
    function startLoading() {
        loading.value = true
    }

    function stopLoading() {
        requestIdleCallback(() => {
            loading.value = false
        })
    }

    return { loading, startLoading, stopLoading }
}
