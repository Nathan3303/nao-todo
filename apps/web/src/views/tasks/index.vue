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
import { ref } from 'vue'
import { TasksAside, TasksOutline } from '@/layouts/tasks'
import { useTasksDataStore } from '@/stores/tasks'
import { TasksDialogs } from '@/components/tasks/dialogs'
import { Loading as LoadingComp } from '@nao-todo/components'
import { onBeforeRouteUpdate } from 'vue-router'

defineOptions({ name: 'TasksViewIndex' })

const tasksDataStore = useTasksDataStore()

const loading = ref(true)

tasksDataStore.getProjectsAndTags().then(() => {
    loading.value = false
})

// @beforeRouteLeave 处理回到当前路由的父级路由的问题
onBeforeRouteUpdate((to, from, next) => {
    let disabled = false
    switch (to.meta.category) {
        case 'basic':
            disabled = to.params.viewId === from.params.viewId
            break
        case 'project':
            disabled = to.params.projectId === from.params.projectId
            break
        case 'tag':
            disabled = to.params.tagId === from.params.tagId
            break
        default:
            disabled = false
            break
    }
    disabled = disabled && to.params.viewType === void 0 && to.params.todoId === void 0
    next(!disabled)
})
</script>

