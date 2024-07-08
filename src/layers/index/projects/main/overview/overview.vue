<template>
    <div class="overview-wrapper">
        <nue-div class="pinned-tasks" vertical theme="card">
            <nue-text>Pinned Tasks</nue-text>
            <nue-divider></nue-divider>
            <nue-div vertical gap="12px" align="stretch">
                <nue-text size="12px" color="gray" align="center">No pinned tasks</nue-text>
            </nue-div>
        </nue-div>
        <nue-div class="state-overview" vertical theme="card">
            <nue-text>State Overview</nue-text>
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
            </nue-div>
        </nue-div>
        <nue-div class="third-block" vertical theme="card">
            <nue-text>Third Block</nue-text>
            <nue-divider></nue-divider>
        </nue-div>
        <nue-div class="fourth-block" vertical theme="card">
            <nue-text>Project Details</nue-text>
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

defineProps<ProjectsMainOverviewProps>()

// const projectStore = useProjectStore()
const todoStore = useTodoStore()

const { countInfo } = storeToRefs(todoStore)
</script>

<style scoped>
@import url('./overview.css');
</style>
