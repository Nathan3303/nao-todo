<template>
    <nue-main aside-width="256px">
        <template #aside v-if="projectAsideVisible">
            <projects-aside></projects-aside>
        </template>
        <template #content>
            <router-view></router-view>
        </template>
    </nue-main>
</template>

<script setup lang="ts">
import { ProjectsAside } from '@/layers/index/projects'
import { useProjectStore, useTodoStore, useViewStore, useUserStore } from '@/stores'
import { useLoadingScreen } from '@/hooks'
import { storeToRefs } from 'pinia'

const userStore = useUserStore()
const projectStore = useProjectStore()
const todoStore = useTodoStore()
const viewStore = useViewStore()

const { projectAsideVisible } = storeToRefs(viewStore)

await projectStore.getProjects()
await todoStore.getAllTodos(userStore.user!.id)
useLoadingScreen().stopLoading()
</script>
