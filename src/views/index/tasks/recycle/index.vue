<template>
    <nue-container class="tasks-today-view tasks-sub-view">
        <todo-view-header title="垃圾桶">
            <template #subTitle>
                "垃圾桶" 板块存放着您已删除的任务，您可以在这里选择性地恢复已删除的任务。
            </template>
            <template #navigations>
                <nue-link theme="btnlike" :route="{ name: 'tasks-recycle-table' }">
                    任务列表
                </nue-link>
                <nue-link theme="btnlike" :route="{ name: 'tasks-recycle-kanban' }">
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
/* @import url('./index.css'); */
</style>
