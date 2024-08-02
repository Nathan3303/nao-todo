import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useViewStore = defineStore('viewStore', () => {
    const isMobile = ref(false)
    const projectAsideVisible = ref(true)
    const simpleProjectHeader = ref(false)

    // Watch window size and update isMobile
    const updateIsMobile = () => {
        const isMobileNow = window.innerWidth <= 768
        isMobile.value = isMobileNow
        projectAsideVisible.value = !isMobileNow
    }
    window.addEventListener('resize', updateIsMobile)
    updateIsMobile()

    const toggleProjectAsideVisible = () => {
        projectAsideVisible.value = !projectAsideVisible.value
    }

    const toggleSimpleProjectHeader = () => {
        simpleProjectHeader.value = !simpleProjectHeader.value
    }

    return {
        isMobile,
        projectAsideVisible,
        simpleProjectHeader,
        toggleProjectAsideVisible,
        toggleSimpleProjectHeader
    }
})
