<script lang="ts" setup>
import { AppAside } from '@/layouts/app'
import { APP_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { AppContext } from '@/app'
import { inject } from 'vue'
import useIndexView from './index-view'

defineOptions({ name: 'AppContainer' })

const { isDisplayHeader } = inject<AppContext>(APP_CONTEXT_KEY)!
    
const { userUseCase } = useIndexView()

await userUseCase.loadUserProfile()
</script>

<template>
    <nue-container id="AppContainer">
        <nue-main>
            <nue-aside v-if="isDisplayHeader">
                <app-aside />
            </nue-aside>
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

