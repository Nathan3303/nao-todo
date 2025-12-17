import { useViewStore } from '@/stores/global'
import { defineStore, storeToRefs } from 'pinia'
import { computed } from 'vue'

const useAuthViewStore = defineStore('AuthViewStore', () => {
    // @stores
    const viewStore = useViewStore()

    // @states 前置状态
    const { responsiveFlag } = storeToRefs(viewStore)

    // @computed 是否显示侧边栏
    const isDisplayAside = computed(() => {
        return responsiveFlag.value > 2
    })

    // @returns
    return {
        isDisplayAside
    }
})

export default useAuthViewStore
