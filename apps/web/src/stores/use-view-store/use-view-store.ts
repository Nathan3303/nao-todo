import { reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { useProjectStore, useTagStore } from '@/stores'

export const useViewStore = defineStore('viewStore', () => {
    // const userStore = useUserStore()
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

    const indexViewInitTask = async () => {
        try {
            indexViewLoader.loading = true
            await projectStore.doGetProjects()
            await tagStore.doGetTags()
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
