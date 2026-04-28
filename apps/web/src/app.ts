import { onMounted } from 'vue'
import useResponsiveFlag, {
    responsiveTypes
} from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import { computed, provide, reactive, type Ref } from 'vue'
import { APP_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import useTasksStore from './stores/tasks/tasks-store'

export type AppContext = {
    routerLinks: { name: string; icon: string; route: string; routeName: string }[]
    responsiveFlag: Ref<number>
    isDisplayHeader: Ref<boolean>
}

const useApp = () => {
    const routerLinks = reactive([
        { name: '任务', icon: 'square-check-fill', route: '/tasks', routeName: 'tasks' },
        { name: '设置', icon: 'settings-fill', route: '/settings', routeName: 'settings' }
    ])

    const { flag } = useResponsiveFlag()

    const isDisplayHeader = computed(() => flag.value > responsiveTypes.MOBILE)

    provide<AppContext>(APP_CONTEXT_KEY, {
        routerLinks,
        responsiveFlag: flag,
        isDisplayHeader
    })

    onMounted(async () => {
        const tasksStore = useTasksStore()
        await tasksStore.initializeFromIndexedDB()
    })
}

export default useApp
