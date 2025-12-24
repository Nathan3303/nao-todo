import { defineStore } from 'pinia'
import { useAuthApp } from '@nao-todo/application'
import { reactive, ref } from 'vue'
import { useAsideWidth } from '@nao-todo/hooks'
import { useAuthDomain } from '@nao-todo/domain'
import { useAuthRepository } from '@nao-todo/infrastructure/backend/auth/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'

export default defineStore('AuthViewStore', () => {
    // @appInstant Auth app
    const authApp = useAuthApp(
        useAuthDomain(useAuthRepository(getRequesterImpl())),
        reactive({
            userToken: null,
            isAuthenticated: false
        })
    )

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
        authApp,
        isDisplayAside,
        asideWidth,
        handleResizeAside,
        hideFirstLoadingScreen
    }
})
