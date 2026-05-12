<script lang="ts" setup>
import { onMounted, ref } from 'vue'
// import { AppAside } from '@/layouts/app'
import useIndexView from './index-view'
import { Loading as LoadingComp } from '@nao-todo/components'

defineOptions({ name: 'AppContainer' })

const { userUseCase, loadUserThemeModeFromConfig } = useIndexView()

const isLoading = ref(true)

onMounted(async () => {
    await userUseCase.loadUserProfile()
    await userUseCase.loadUserConfig()
    loadUserThemeModeFromConfig()
    isLoading.value = false
})
</script>

<template>
    <loading-comp v-if="isLoading" height="100vh" placeholder="正在加载用户信息..." />
    <nue-container v-else id="AppContainer">
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <router-view v-slot="{ Component }">
                    <suspense>
                        <component :is="Component" />
                        <template #fallback>
                            <loading-comp height="100%" />
                        </template>
                    </suspense>
                </router-view>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

