<template>
    <loading-comp
        v-if="tasksViewStore.initializer.loading"
        :placeholder="tasksViewStore.initializer.placeholder"
        height="100%"
    />
    <nue-empty
        v-else-if="tasksViewStore.initializer.error"
        :description="tasksViewStore.initializer.errorMessage"
        height="100%"
    >
        <nue-button theme="primary,small" @click="tasksViewStore.initializer.retry">
            重试
        </nue-button>
    </nue-empty>
    <nue-container v-else>
        <nue-main>
            <tasks-aside />
            <nue-content fill style="overflow: hidden">
                <router-view />
            </nue-content>
            <tasks-outline />
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { TasksAside, TasksOutline } from '@/layouts/tasks'
import { Loading as LoadingComp } from '@nao-todo/components'
import useTasksViewStore from './tasks-view-store'

defineOptions({ name: 'TasksView' })

const tasksViewStore = useTasksViewStore()

await tasksViewStore.initializer.start()
tasksViewStore.appStore.hideFirstLoadingScreen()
</script>
