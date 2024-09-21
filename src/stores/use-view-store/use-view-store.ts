import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useViewStore = defineStore('viewStore', () => {
    const projectAsideVisible = ref(true)
    const simpleProjectHeader = ref(false)
    // const tasksBasicViewData = reactive({})

    const toggleProjectAsideVisible = () => {
        projectAsideVisible.value = !projectAsideVisible.value
    }

    const toggleSimpleProjectHeader = () => {
        simpleProjectHeader.value = !simpleProjectHeader.value
    }

    return {
        projectAsideVisible,
        simpleProjectHeader,
        toggleProjectAsideVisible,
        toggleSimpleProjectHeader
    }
})
