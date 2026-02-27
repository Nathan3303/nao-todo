<script lang="ts" setup>
import { TasksViewAsideAdapter, TasksViewDetailsAdapter, TasksViewDialogs } from '@/layouts/tasks'
import useTasksView from './tasks-view'
import { Loading as LoadingComp } from '@nao-todo/components'
import { onMounted } from 'vue'

defineOptions({ name: 'TasksView' })

const { isLoading, error, init } = useTasksView()

onMounted(() => init())
</script>

<template>
    <loading-comp v-if="isLoading" height="100%" />
    <nue-empty v-else-if="error" :description="error" height="100%">
        <nue-button theme="primary,small" @click="init">重试</nue-button>
    </nue-empty>
    <nue-container v-else>
        <nue-main>
            <tasks-view-aside-adapter />
            <nue-content fill style="overflow: hidden">
                <router-view v-slot="{ Component }">
                    <suspense>
                        <component :is="Component" />
                        <template #fallback> Loading... </template>
                    </suspense>
                </router-view>
            </nue-content>
            <tasks-view-details-adapter />
        </nue-main>
    </nue-container>
    <tasks-view-dialogs />
</template>

