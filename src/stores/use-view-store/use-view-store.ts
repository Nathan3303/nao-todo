import { reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { useProjectStore, useTagStore, useUserStore } from '@/stores'
import { useRouter } from 'vue-router'

export const useViewStore = defineStore('viewStore', () => {
    const router = useRouter()
    const userStore = useUserStore()
    const projectStore = useProjectStore()
    const tagStore = useTagStore()

    const indexViewLoader = reactive({
        loading: false,
        error: false,
        errorMessage: null as Error | null,
        checkedIn: false
    })
    const projectAsideVisible = ref(true)
    const simpleProjectHeader = ref(false)

    const toggleProjectAsideVisible = () => {
        projectAsideVisible.value = !projectAsideVisible.value
    }

    const toggleSimpleProjectHeader = () => {
        simpleProjectHeader.value = !simpleProjectHeader.value
    }

    const handleCheckIn = async () => {
        if (!userStore.isAuthenticated) return false
        await userStore.checkin()
        if (!userStore.isAuthenticated) return false
        return true
        // const isLoggedIn = await userStore.isLoggedIn()
        // if (!isLoggedIn) return false
        // if (!userStore.isAuthenticated) {
        //     router.replace('/authentication/login')
        // }
    }

    const indexViewInitTask = async () => {
        // const userStore = useUserStore()
        // const loadingScreen = useLoadingScreen()
        try {
            indexViewLoader.loading = true
            const userId = userStore.user!.id
            await projectStore.init(userId, { page: 1, limit: 99 })
            await tagStore.initialize(userId, { page: 1, limit: 99 })
        } catch (e) {
            indexViewLoader.error = true
            indexViewLoader.errorMessage = e as Error
        } finally {
            indexViewLoader.loading = false
        }
    }

    return {
        indexViewLoader,
        projectAsideVisible,
        simpleProjectHeader,
        toggleProjectAsideVisible,
        toggleSimpleProjectHeader,
        indexViewInitTask
    }
})
