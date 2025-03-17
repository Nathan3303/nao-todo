import { onMounted, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { useProjectStore, useTagStore } from '@/stores'
import { useWindowResizeListener } from '@nao-todo/hooks'

export const useViewStore = defineStore('viewStore', () => {
    const projectStore = useProjectStore()
    const tagStore = useTagStore()
    const { addCallback: addWindowResizeCb } = useWindowResizeListener()

    const responsiveFlag = ref<number>(2)
    const indexViewLoader = reactive({
        loading: false,
        error: false,
        errorMessage: null as Error | null,
        checkedIn: false
    })
    const projectAsideVisible = ref(true)
    const indexHeaderVisible = ref(true)
    const tasksOutlineVisible = ref(true)
    const indexAsideVisible = ref(false)

    const toggleProjectAsideVisible = () => {
        if (responsiveFlag.value > 1) {
            projectAsideVisible.value = !projectAsideVisible.value
        } else {
            indexAsideVisible.value = !indexAsideVisible.value
        }
    }

    const hideFirstLoadingScreen = () => {
        const _fn = () => {
            const fls = document.getElementById('firstLoadingScreen')
            if (!fls) return
            fls.style.transition = 'opacity 320ms ease-in-out'
            fls.style.opacity = '0'
            setTimeout(() => (fls.style.display = 'none'), 320)
        }
        if (window.requestIdleCallback) {
            window.requestIdleCallback(_fn)
        } else {
            _fn()
        }
    }

    const indexViewInitTask = async () => {
        try {
            // indexViewLoader.loading = true
            await Promise.all([projectStore.doGetProjects(), tagStore.doGetTags()])
        } catch (e) {
            indexViewLoader.error = true
            indexViewLoader.errorMessage = e as Error
        } finally {
            // indexViewLoader.loading = false
            hideFirstLoadingScreen()
        }
    }

    const responsiveUpdate = () => {
        const BPS = [445, 800, 1200]
        const innerWidth = window.innerWidth
        responsiveFlag.value = 3
        if (isNaN(innerWidth)) return
        for (let i = 0; i < BPS.length; i++) {
            if (innerWidth <= BPS[i]) {
                responsiveFlag.value = i
                break
            }
        }
        indexHeaderVisible.value = responsiveFlag.value > 1
        projectAsideVisible.value = responsiveFlag.value > 1
        tasksOutlineVisible.value = responsiveFlag.value > 2
    }

    addWindowResizeCb(() => responsiveUpdate())
    onMounted(() => {
        responsiveUpdate()
    })

    return {
        indexAsideVisible,
        indexViewLoader,
        projectAsideVisible,
        indexHeaderVisible,
        responsiveFlag,
        tasksOutlineVisible,
        toggleProjectAsideVisible,
        indexViewInitTask,
        hideFirstLoadingScreen
    }
})
