import { ref } from 'vue'
import { useMinuteTask } from '@nao-todo/hooks/use-minute-task'

export const useRefreshKey = () => {
    const refreshKey = ref(Math.random())

    const refresh = () => (refreshKey.value = Math.random())

    const { run: startRefresh, stop: stopRefresh } = useMinuteTask(refresh)

    return {
        refreshKey,
        startRefresh,
        stopRefresh
    }
}
