<template>
    <loading-comp v-if="loading" style="height: 100%" />
    <nue-container v-else>
        <nue-main>
            <tasks-aside />
            <nue-content fill style="overflow: hidden">
                <router-view />
            </nue-content>
            <tasks-outline />
        </nue-main>
    </nue-container>
    <tasks-dialogs />
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useRoute, onBeforeRouteLeave } from 'vue-router'
import { TasksAside, TasksOutline } from '@/layouts/tasks'
import { useTasksDataStore, useTasksViewStore } from '@/stores/tasks'
import { TasksDialogs } from '@/components/tasks/dialogs'
import { Loading as LoadingComp } from '@nao-todo/components'
import { ref } from 'vue'

const tasksDataStore = useTasksDataStore()
const tasksViewStore = useTasksViewStore()
const route = useRoute()

const { viewProps } = storeToRefs(tasksViewStore)
const loading = ref(true)

tasksDataStore.getProjectsAndTags().then(() => {
    loading.value = false
})

// @fix: 路由切换后需要清空 viewProps 数据，否则会导致切换到其他路由后返回当前路由时，会显示旧的待办任务数据
onBeforeRouteLeave(() => {
    setTimeout(() => {
        if ((route.name as string).startsWith('tasks')) return
        viewProps.value = void 0
    }, 1000)
})
</script>
