import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAsideWidth } from '@nao-todo/hooks'
import useAppStore from '@/views/app-store'

export default defineStore('AuthViewStore', () => {
    // @store App store
    const appStore = useAppStore()

    // @hook 侧边栏宽度
    const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(256)

    // @state isDisplayAside
    const isDisplayAside = ref(true)

    // @returns
    return {
        authUseCase: appStore.authUseCase,
        isDisplayAside,
        asideWidth,
        handleResizeAside
    }
})

