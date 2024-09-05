<template>
    <nue-container class="tasks-today-view tasks-sub-view">
        <todo-view-header title="收集箱">
            <template #subTitle>
                “收集箱”
                板块是一个用于快速捕捉和记录灵感、想法和任务的地方。无论是工作中的突发任务、生活中的待办事项，还是随机的灵感和想法，都可以先放入收集箱，稍后再进行整理和分类。
            </template>
            <template #navigations>
                <nue-link theme="btnlike" :route="{ name: 'tasks-inbox-table' }">
                    任务列表
                </nue-link>
                <nue-link theme="btnlike" :route="{ name: 'tasks-inbox-kanban' }">
                    任务看板
                </nue-link>
            </template>
        </todo-view-header>
        <nue-main>
            <router-view></router-view>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { TodoViewHeader } from '@/layers'
</script>

<style scoped>
@import url('../common/index.css');
</style>
