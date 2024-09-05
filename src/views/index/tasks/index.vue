<template>
    <nue-main class="tasks-view" aside-width="240px">
        <template #aside v-if="pav">
            <todo-view-aside />
        </template>
        <template #content>
            <router-view />
        </template>
        <nue-div id="TasksViewRightAside">
            <nue-div class="todo-details-wrapper" :data-empty="!$route.params.taskId">
                <todo-details-v2 />
            </nue-div>
        </nue-div>
    </nue-main>
</template>

<script setup lang="ts">
import { TodoViewAside, TodoDetailsV2 } from '@/layers'
import { storeToRefs } from 'pinia'
import { useLoadingScreen } from '@/hooks'
import { useViewStore, useProjectStore, useUserStore, useTagStore } from '@/stores'

const viewStore = useViewStore()
const projectStore = useProjectStore()
const userStore = useUserStore()
const tagStore = useTagStore()

const { projectAsideVisible: pav } = storeToRefs(viewStore)

await projectStore.init(userStore.user!.id, {
    isDeleted: false,
    isArchived: false,
    page: 1,
    limit: 99
})
await tagStore.initialize(userStore.user!.id, {
    isDeleted: false,
    // isArchived: false,
    page: 1,
    limit: 99
})
useLoadingScreen().stopLoading()
</script>

<style scoped>
@import url('./index.css');
</style>
