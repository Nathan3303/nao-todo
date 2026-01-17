import useAutoChangeTheme from '@/infrastructure/hooks/tasks-view/use-auto-change-theme'
import { useUserApp } from '@nao-todo/application'
import { useResponsiveFlag } from '@nao-todo/hooks'
import { responsiveTypes } from '@nao-todo/hooks/use-responsive-flag/use-responsive-flag'
import { defineStore } from 'pinia'
import { computed, reactive } from 'vue'

export default defineStore('ViewStore', () => {
    // @appInstants
    const userApp = useUserApp()

    // @state Router links
    const routerLinks = reactive([
        { name: '任务', icon: 'square-check-fill', route: '/tasks', routeName: 'tasks' },
        { name: '搜索', icon: 'search2', route: '/search', routeName: 'search' }
    ])

    // @hook 响应式标记
    const { flag } = useResponsiveFlag()

    // @state Header 响应式渲染标记
    const isDisplayHeader = computed(() => flag.value > responsiveTypes.MOBILE)

    // @hook 主题色自动变化
    useAutoChangeTheme(true)

    // @returns
    return {
        userApp,
        routerLinks,
        responsiveFlag: flag,
        isDisplayHeader
    }
})
