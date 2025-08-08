<template>
    <nue-container>
        <nao-tasks-view-content-header />
        <nue-main>
            <router-view />
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { onBeforeRouteUpdate } from 'vue-router'
import { useTasksViewStore } from '../stores'
import NaoTasksViewContentHeader from './header.vue'
import type { TasksViewContentProps } from './types'

defineOptions({ name: 'NaoTasksViewContent' })
defineProps<TasksViewContentProps>()

const tasksViewStore = useTasksViewStore()

const { category } = storeToRefs(tasksViewStore)

// 处理路由重复问题
onBeforeRouteUpdate((to, from, next) => {
    const toName = (to.name as string).split('-').slice(0, 2).join('-')
    const fromName = from.name as string
    if ((fromName.endsWith('kanban') || fromName.endsWith('table')) && to.name === toName) {
        if (category.value === 'project' && to.params.projectId !== from.params.projectId) {
            return next()
        }
        if (category.value === 'tag' && to.params.tagId !== from.params.tagId) {
            return next()
        }
        return next(false)
    }
    next()
})

// 获取视图信息
watchEffect(() => tasksViewStore.getViewInfo())
</script>

<style>
.tasks-main-view {
    box-sizing: border-box;
    min-width: 375px;

    .tasks-main-view__header {
        box-sizing: border-box;
        height: auto;
        flex-direction: column;
        gap: 16px;
    }

    .tasks-main-view__header__title-bar {
        flex-direction: column;
        flex-wrap: nowrap;
        gap: 4px;

        .tasks-main-view__header__title-bar__actions {
            align-items: center;
            width: auto;
            flex-shrink: 0;
            gap: 8px;
        }
    }

    .tasks-main-view__main {
        border: none !important;
    }
}
</style>
