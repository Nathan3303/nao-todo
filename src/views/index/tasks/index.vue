<template>
    <nue-main class="tasks-view" aside-width="256px">
        <template #aside v-if="asideVisible">
            <tasks-view-aside></tasks-view-aside>
        </template>
        <template #content>
            <router-view></router-view>
        </template>
        <nue-div id="TasksViewRightAside"></nue-div>
    </nue-main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { TasksViewAside } from '@/layers/index/tasks'
import { storeToRefs } from 'pinia'
import { useLoadingScreen } from '@/hooks'
import { useViewStore } from '@/stores'

const viewStore = useViewStore()

const { projectAsideVisible: asideVisible } = storeToRefs(viewStore)

useLoadingScreen().stopLoading()
</script>

<style scoped>
@import './index.css';
</style>
