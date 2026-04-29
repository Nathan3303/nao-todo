<script lang="ts" setup>
import { onMounted, inject, ref } from 'vue'
import { AppAside } from '@/layouts/app'
import { APP_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { AppContext } from '@/app'
import useIndexView from './index-view'
import { Loading as LoadingComp } from '@nao-todo/components'

defineOptions({ name: 'AppContainer' })

const { isDisplayHeader } = inject<AppContext>(APP_CONTEXT_KEY)!

const { userUseCase } = useIndexView()

const isLoading = ref(true)

onMounted(async () => {
    await userUseCase.loadUserProfile()
    isLoading.value = false
})
</script>

<template>
    <loading-comp v-if="isLoading" height="100vh" placeholder="正在加载用户信息..." />
    <nue-container v-else id="AppContainer">
        <nue-main>
            <nue-aside v-if="isDisplayHeader">
                <app-aside />
            </nue-aside>
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

<style scoped>
.nue-container#AppContainer > .nue-main .nue-aside {
    align-items: center;
    width: 70px;
    min-width: 70px;
    max-width: 70px;
}
</style>
