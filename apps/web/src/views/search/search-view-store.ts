import { defineStore } from 'pinia'
import useAppStore from '@/views/app-store'

export default defineStore('SearchViewStore', () => {
    // @store
    const appStore = useAppStore()

    // @returns
    return {
        appStore
    }
})
