import { reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { useProjectStore, useTagStore, useUserStore } from '..'
import { useProjectStoreV2 } from '..'

export const useViewStore = defineStore('viewStore', () => {
    const userStore = useUserStore()
    const projectStore = useProjectStoreV2()
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

    const indexViewInitTask = async () => {
        try {
            indexViewLoader.loading = true
            // const userId = userStore.user!.id
            // await projectStore.init(userId, { page: 1, limit: 99 })
            await projectStore.fetchProjects()
            // await tagStore.initialize(userId, { page: 1, limit: 99 })
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
