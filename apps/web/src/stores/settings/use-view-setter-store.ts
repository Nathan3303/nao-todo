import { defineStore, storeToRefs } from 'pinia'
import { useViewStore } from '@/stores/global'

const useViewSetterStore = defineStore('ViewSetterStore', () => {
    // @stores 全局 store
    const viewStore = useViewStore()

    // @states 前置状态
    const { tasksDefaults } = storeToRefs(viewStore)

    // @returns
    return {
        tasksDefaults
    }
})

export default useViewSetterStore
