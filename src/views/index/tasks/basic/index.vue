<template>
    <nue-container id="tasks/basic" theme="vertical,inner">
        <todo-view-header :title="viewInfo.title">
            <template #subTitle>
                {{ viewInfo.description }}
            </template>
            <template #navigations>
                <nue-link theme="btnlike" :route="{ name: `tasks-${$route.meta.type}-table` }">
                    列表视图
                </nue-link>
                <nue-link theme="btnlike" :route="{ name: `tasks-${$route.meta.type}-kanban` }">
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
import { ref, provide, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { basicViewContextKey, basicViewsInfo } from './constants'
import { TodoViewHeader } from '@/layers'
import { useTodoStore } from '@/stores'
import type { BasicViewContext, BasicViewInfo } from './types'

const route = useRoute()
const todoStore = useTodoStore()

let firstLoadFlag = true;
const viewInfo = ref<BasicViewInfo>({
    title: '',
    description: '',
    default: { viewType: 'table', filterInfo: {} }
})

watchEffect(() => {
    const { meta } = route
    if (!firstLoadFlag && meta.category === "basic") return;
    todoStore.resetOptions()
    document.title = 'NaoTodo - ' + meta.title
    viewInfo.value = basicViewsInfo[meta.type as string]
    firstLoadFlag = false
})

provide<BasicViewContext>(basicViewContextKey, { viewInfo })
</script>
