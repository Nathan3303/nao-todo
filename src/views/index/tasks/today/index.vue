<template>
    <nue-container class="tasks-today-view tasks-sub-view">
        <content-header title="今天">
            <template #subTitle>
                “今天”
                板块是你的日常任务管理中心，专注于帮助你高效地组织和跟踪每天的待办事项。这里展示了你今天需要完成的所有任务，确保你不会遗漏任何重要的事情。
            </template>
            <template #navigations>
                <nue-link theme="btnlike" :route="{ name: 'tasks-today-table' }">
                    任务列表
                </nue-link>
                <nue-link theme="btnlike" :route="{ name: 'tasks-today-kanban' }">
                    任务看板
                </nue-link>
            </template>
        </content-header>
        <nue-main>
            <router-view></router-view>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { ContentHeader } from '@/layers/index'
</script>

<style scoped>
@import url('../common/index.css');
</style>
