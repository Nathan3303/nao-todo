<template>
    <nue-container theme="vertical,inner" id="Index/Tasks/Basic">
        <todo-view-header :title="viewContent.title">
            <template #subTitle>
                {{ viewContent.description }}
            </template>
            <template #navigations>
                <nue-link theme="btnlike" :route="{ name: `tasks-${$route.meta.type}-table` }">
                    任务列表
                </nue-link>
                <nue-link theme="btnlike" :route="{ name: `tasks-${$route.meta.type}-kanban` }">
                    任务看板
                </nue-link>
            </template>
        </todo-view-header>
        <nue-main style="border: none">
            <router-view></router-view>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue'
import { useRoute } from 'vue-router'
import { TasksBasicViewContent, TasksBasicViewContentKey } from './constants'
import { handlers } from './handler'
import { TodoViewHeader } from '@/layers'
import { useTodoStore } from '@/stores'
import type { TasksBasicViewContext, TasksBasicViewContentType } from './types'

const route = useRoute()
const todoStore = useTodoStore()

const viewContent = computed<TasksBasicViewContentType>(() => {
    const routeName = route.meta.type as string
    const _viewContent = TasksBasicViewContent[
        routeName as keyof typeof TasksBasicViewContent
    ] as TasksBasicViewContentType
    todoStore.resetOptions()
    return (
        _viewContent || {
            title: '',
            description: '',
            default: { viewType: 'table', filterInfo: {} }
        }
    )
})

const viewHandlers = computed(() => {
    const routeName = route.meta.type as string
    const _viewHandlers = handlers[routeName as keyof typeof handlers]
    return _viewHandlers || {}
})

provide<TasksBasicViewContext>(TasksBasicViewContentKey, {
    viewContent,
    viewHandlers
})
</script>
