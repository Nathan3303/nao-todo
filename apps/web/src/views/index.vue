<script lang="ts" setup>
import { onMounted } from 'vue'
import { useViewStore } from '@/stores/global'
import { OfflineScreen } from '@/components/ui'
import { GlobalAside } from '@/layouts/global'
import { NueContainer } from 'nue-ui'

defineOptions({ name: 'AppContainer' })

const viewStore = useViewStore()

// @mounted 初始化 - 隐藏首屏加载器
onMounted(() => {
    viewStore.hideFirstLoadingScreen()
})
</script>

<template>
    <offline-screen />
    <nue-container id="AppContainer">
        <nue-main>
            <global-aside />
            <nue-content fill style="overflow: hidden">
                <router-view />
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

