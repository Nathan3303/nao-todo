<script lang="ts" setup>
import { GlobalAside } from '@/layouts/global'
import { NueContainer } from 'nue-ui'
import useViewStore from './view-store'

defineOptions({ name: 'AppContainer' })

await useViewStore().getProfile()
</script>

<template>
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
