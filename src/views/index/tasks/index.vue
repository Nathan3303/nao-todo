<template>
    <nue-main class="tasks-view" aside-width="240px">
        <template #aside v-if="pav">
            <tasks-view-aside></tasks-view-aside>
        </template>
        <template #content>
            <router-view></router-view>
        </template>
        <nue-div id="TasksViewRightAside">
            <nue-div class="todo-details-wrapper" :data-empty="!$route.params.taskId">
                <content-todo-details-v2 />
            </nue-div>
        </nue-div>
    </nue-main>
</template>

<script setup lang="ts">
import { TasksViewAside, ContentTodoDetailsV2 } from '@/layers/index/tasks'
import { storeToRefs } from 'pinia'
import { useLoadingScreen } from '@/hooks'
import { useViewStore, useProjectStore, useUserStore, useTagStore } from '@/stores'

const viewStore = useViewStore()
const projectStore = useProjectStore()
const userStore = useUserStore()
const tagStore = useTagStore()

const { projectAsideVisible: pav } = storeToRefs(viewStore)

await projectStore.init(userStore.user!.id, { isDeleted: false, isArchived: false })
await tagStore.init(userStore.user!.id, { isDeleted: false })
useLoadingScreen().stopLoading()
</script>

<style scoped>
@import url('./index.css');
</style>
