<template>
    <nue-container id="tasks/main" theme="vertical,inner">
        <todo-view-header>
            <template #actions>
                <template v-if="category === 'project'">
                    <nue-tooltip size="small" content="删除清单">
                        <nue-button
                            theme="icon-only"
                            icon="delete"
                            @click="tasksViewStore.handleRemoveProject"
                        />
                    </nue-tooltip>
                </template>
            </template>
            <template #navigations>
                <nue-link theme="btnlike" :route="{ name: `tasks-${$route.meta.id}-table` }">
                    列表视图
                </nue-link>
                <nue-link theme="btnlike" :route="{ name: `tasks-${$route.meta.id}-kanban` }">
                    看板视图
                </nue-link>
            </template>
        </todo-view-header>
        <nue-main style="border: none">
            <router-view></router-view>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { watchEffect } from 'vue'
import { TodoViewHeader } from '@/layers'
import { useTasksViewStore } from '../stores'
import { storeToRefs } from 'pinia'

const tasksViewStore = useTasksViewStore()

const { category } = storeToRefs(tasksViewStore)

watchEffect(async () => await tasksViewStore.getViewInfo())
</script>
