import { defineStore } from 'pinia'
import { useAuthApp } from '@nao-todo/application'
import { ref } from 'vue'
import { useAsideWidth } from '@nao-todo/hooks'

export default defineStore('AuthViewStore', () => {
    // @appInstants
    const authApp = useAuthApp()

    // @hook 侧边栏宽度
    const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(256)

    // @state isDisplayAside
    const isDisplayAside = ref(true)

    // @method 隐藏首屏加载
    const hideFirstLoadingScreen = () => {
        const fls = document.getElementById('firstLoadingScreen')
        if (!fls) return
        fls.style.transition = 'opacity 320ms ease-in-out'
        fls.style.opacity = '0'
        setTimeout(() => (fls.style.display = 'none'), 320)
    }

    // @returns
    return {
        isAuthenticated: authApp.isAuthenticated,
        signIn: authApp.signIn,
        signUp: authApp.signUp,
        checkIn: authApp.checkIn,
        isDisplayAside,
        asideWidth,
        handleResizeAside,
        hideFirstLoadingScreen
    }
})
