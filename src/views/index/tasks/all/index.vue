<template>
    <nue-container class="tasks-today-view tasks-sub-view">
        <todo-view-header title="所有">
            <template #subTitle>
                "所有"
                板块是一个集中展示和管理所有任务的区域，你可以查看当前所有进行中的任务、即将到期的任务以及已完成的任务。
            </template>
            <template #navigations>
                <nue-link theme="btnlike" :route="{ name: 'tasks-all-table' }"> 任务列表 </nue-link>
                <nue-link theme="btnlike" :route="{ name: 'tasks-all-kanban' }">
                    任务看板
                </nue-link>
            </template>
        </todo-view-header>
        <nue-main>
            <router-view />
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { TodoViewHeader } from '@/layers'
</script>

<style scoped>
@import url('../common/index.css');
</style>
