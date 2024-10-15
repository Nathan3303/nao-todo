import { ref } from 'vue'
import { useMinuteTask } from '@/hooks/use-minute-task'

export const useRefreshKey = () => {
    const refreshKey = ref(0)

    const refresh = () => {
        refreshKey.value++
    }

    const { run: startRefresh, stop: stopRefresh } = useMinuteTask(refresh)

    return {
        refreshKey,
        startRefresh,
        stopRefresh
    }
}
