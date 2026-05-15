<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import useIndexView from './index-view'
import { AppDialogAdapter } from '@/layouts/app/dialogs'
import { Loading as LoadingComp } from '@nao-todo/components'
import { LAST_VISITED_ROUTE_KEY } from '@/router'

defineOptions({ name: 'AppContainer' })

const route = useRoute()
const router = useRouter()
const { userUseCase, loadUserThemeModeFromConfig } = useIndexView()

const isLoading = ref(true)

onMounted(async () => {
    await userUseCase.loadUserProfile()
    await userUseCase.loadUserConfig()
    loadUserThemeModeFromConfig()
    isLoading.value = false

    if (route.name === 'index') {
        const lastRoute = localStorage.getItem(LAST_VISITED_ROUTE_KEY)
        router.replace(lastRoute || '/tasks')
    }
})
</script>

<template>
    <loading-comp v-if="isLoading" height="100vh" placeholder="正在加载用户信息..." />
    <nue-container v-else id="AppContainer">
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <!-- 路由视图 -->
                <router-view v-slot="{ Component }">
                    <suspense>
                        <component :is="Component" />
                        <template #fallback>
                            <loading-comp height="100%" />
                        </template>
                    </suspense>
                </router-view>
                <!-- 任务视图对话框 -->
                <!-- <tasks-view-dialogs /> -->
                <app-dialog-adapter />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

