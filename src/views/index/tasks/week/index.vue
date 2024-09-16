<template>
    <nue-container class="tasks-week-view tasks-sub-view">
        <todo-view-header title="最近 7 天">
            <template #subTitle>
                “最近7天”
                板块是你的短期计划管理区，专为帮助你掌握未来一周的待办事项而设计。在这里，你可以浏览并管理接下来7天内需要完成的所有任务，确保你对即将到来的每一天都有清晰的预期。
            </template>
            <template #navigations>
                <nue-link theme="btnlike" :route="{ name: 'tasks-week-table' }">
                    任务列表
                </nue-link>
                <nue-link theme="btnlike" :route="{ name: 'tasks-week-kanban' }">
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
