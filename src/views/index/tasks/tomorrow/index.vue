<template>
    <nue-container class="tasks-tomorrow-view tasks-sub-view">
        <content-header title="明天">
            <template #subTitle>
                “明天”
                板块是你的预备任务清单，帮助你提前规划和准备未来一天的待办事项。通过将即将到来的任务分配到“明天”板块，你可以提前了解明天需要完成的工作，减少临时安排的压力。
            </template>
            <template #navigations>
                <nue-link theme="btnlike" :route="{ name: 'tasks-tomorrow-table' }">
                    任务列表
                </nue-link>
                <nue-link theme="btnlike" :route="{ name: 'tasks-tomorrow-kanban' }">
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
