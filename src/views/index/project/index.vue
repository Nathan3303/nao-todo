<template>
    <nue-main aside-width="256px">
        <template #aside>
            <project-aside></project-aside>
        </template>
        <template #content>
            <router-view></router-view>
        </template>
    </nue-main>
</template>

<script setup lang="ts">
import { ProjectAside } from '@/layers/index'
import { useProjectStore } from '@/stores/use-project-store'
import { useLoadingScreen } from '@/hooks/use-loading-screen'

const projectStore = useProjectStore()

await projectStore.getProjects()
useLoadingScreen().stopLoading()
</script>
