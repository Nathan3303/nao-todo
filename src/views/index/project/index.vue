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
import { useViewStore, useProjectStore, useUserStore, useTagStore } from '@/stores'
import { useLoadingScreen } from '@/hooks'
import { storeToRefs } from 'pinia'

const viewStore = useViewStore()
const projectStore = useProjectStore()
const userStore = useUserStore()
const tagStore = useTagStore()

const { projectAsideVisible } = storeToRefs(viewStore)

await projectStore.init(userStore.user!.id, { isDeleted: false })
await tagStore.init(userStore.user!.id, { isDeleted: false })
useLoadingScreen().stopLoading()
</script>
