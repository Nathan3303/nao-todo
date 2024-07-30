<template>
    <nue-main class="tasks-view" aside-width="256px">
        <template #aside v-if="pav">
            <tasks-view-aside></tasks-view-aside>
        </template>
        <template #content>
            <router-view></router-view>
        </template>
        <nue-div id="TasksViewRightAside">
            <empty
                class="empty-text"
                empty
                message="点击左侧列表中的任务以查看任务详细。"
                text-size="12px"
                full-height
            ></empty>
        </nue-div>
    </nue-main>
</template>

<script setup lang="ts">
import { TasksViewAside } from '@/layers/index/tasks'
import { storeToRefs } from 'pinia'
import { useLoadingScreen } from '@/hooks'
import { useViewStore, useProjectStore, useUserStore } from '@/stores'
import { Empty } from '@/components'

const viewStore = useViewStore()
const projectStore = useProjectStore()
const userStore = useUserStore()

const { projectAsideVisible: pav } = storeToRefs(viewStore)

await projectStore.init(userStore.user!.id, { isDeleted: false, isArchived: false })
useLoadingScreen().stopLoading()
</script>

<style scoped>
@import url('./index.css');
</style>
