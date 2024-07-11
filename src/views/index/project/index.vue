<template>
    <nue-main aside-width="256px">
        <template #aside v-if="!isHide">
            <projects-aside></projects-aside>
        </template>
        <template #content>
            <router-view></router-view>
        </template>
    </nue-main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ProjectsAside } from '@/layers/index/projects'
import { useProjectStore } from '@/stores/use-project-store'
import { useLoadingScreen, useProjectAside } from '@/hooks'

const projectStore = useProjectStore()
const projectAside = useProjectAside()

const isHide = computed(() => projectAside.isHide.value)

await projectStore.getProjects()
useLoadingScreen().stopLoading()
</script>
