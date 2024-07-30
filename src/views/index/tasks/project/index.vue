<template>
    <nue-container class="tasks-project-view tasks-sub-view">
        <content-header :title="project?.title" :project="project">
            <template #subTitle>
                {{ project?.description }}
            </template>
            <template #navigations>
                <nue-link theme="btnlike" :route="{ name: 'tasks-project-table' }">
                    任务列表
                </nue-link>
                <nue-link theme="btnlike" :route="{ name: 'tasks-project-kanban' }">
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
import { computed } from 'vue'
import { ContentHeader } from '@/layers/index'
import { useProjectStore } from '@/stores'
import type { Project } from '@/stores'

const props = defineProps<{ projectId: Project['id'] }>()

const projectStore = useProjectStore()

const project = computed<Project>(() => {
    const { projectId } = props
    const project = projectStore.toFindLocally(projectId)
    document.title = 'NaoTodo - ' + project?.title
    return project as Project
})
</script>

<style scoped>
@import url('../common/index.css');
/* @import url('./index.css'); */
</style>
