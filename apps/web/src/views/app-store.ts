import { useUserApp } from '@nao-todo/application'
import { defineStore } from 'pinia'
import { reactive } from 'vue'

export default defineStore('ViewStore', () => {
    // @appInstants
    const userApp = useUserApp()

    // @state Router links
    const routerLinks = reactive([
        { name: '任务', icon: 'square-check-fill', route: '/tasks', routeName: 'tasks' },
        { name: '搜索', icon: 'search2', route: '/search', routeName: 'search' }
    ])

    // @returns
    return {
        userApp,
        routerLinks
    }
})
