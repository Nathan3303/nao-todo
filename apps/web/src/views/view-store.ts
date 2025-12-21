import { useUserApp } from '@nao-todo/application'
import { defineStore } from 'pinia'

export default defineStore('ViewStore', () => {
    // @appInstants
    const userApp = useUserApp()

    // @method 隐藏首屏加载
    const hideFirstLoadingScreen = () => {
        const fls = document.getElementById('firstLoadingScreen')
        if (!fls) return
        fls.style.transition = 'opacity 320ms ease-in-out'
        fls.style.opacity = '0'
        setTimeout(() => (fls.style.display = 'none'), 320)
    }

    return {
        userProfile: userApp.userProfile,
        getProfile: userApp.getProfile,
        hideFirstLoadingScreen
    }
})
