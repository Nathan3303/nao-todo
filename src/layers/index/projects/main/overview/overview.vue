<template>
    <div class="overview-wrapper">
        <nue-div class="pinned-tasks" vertical theme="card">
            <nue-text>被固定的任务</nue-text>
            <nue-divider></nue-divider>
            <nue-div vertical gap="12px" align="stretch">
                <nue-text size="12px" color="gray" align="center">没有任务被固定</nue-text>
            </nue-div>
        </nue-div>
        <nue-div class="state-overview" vertical theme="card">
            <nue-text>状态计数</nue-text>
            <nue-divider></nue-divider>
            <nue-div vertical gap="12px">
                <state-row icon="todo" title="Total" :count="countInfo.total"></state-row>
                <state-row icon="circle" title="To Do" :count="countInfo.byState.todo"></state-row>
                <state-row
                    icon="in-progress"
                    title="In Progress"
                    :count="countInfo.byState['in-progress']"
                ></state-row>
                <state-row icon="success" title="Done" :count="countInfo.byState.done"></state-row>
                <!-- <state-analysis></state-analysis> -->
            </nue-div>
        </nue-div>
        <nue-div class="third-block" vertical theme="card">
            <nue-text>任务分析</nue-text>
            <nue-divider></nue-divider>
            <todo-analysis></todo-analysis>
        </nue-div>
        <nue-div class="fourth-block" vertical theme="card">
            <nue-text>项目详情</nue-text>
            <nue-divider></nue-divider>
            <project-details :project="project" />
        </nue-div>
    </div>
</template>

<script setup lang="ts">
import type { ProjectsMainOverviewProps } from './types'
import { useTodoStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { ProjectDetails } from '@/components/project'
import StateRow from './state-row.vue'
import TodoAnalysis from './todo-analysis.vue'
import StateAnalysis from './state-analysis.vue'

defineProps<ProjectsMainOverviewProps>()

// const projectStore = useProjectStore()
const todoStore = useTodoStore()

const { countInfo } = storeToRefs(todoStore)
</script>

<style scoped>
@import url('./overview.css');
</style>
