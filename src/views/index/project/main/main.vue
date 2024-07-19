<template>
    <project-not-found v-if="!currentProject" />
    <template v-else>
        <nue-div vertical wrap="nowrap" height="100%">
            <projects-main-header :project="currentProject"></projects-main-header>
            <router-view :key="projectId"></router-view>
        </nue-div>
    </template>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue'
import { useProjectStore, type Project } from '@/stores/use-project-store'
import ProjectNotFound from '@/components/project/project-not-found.vue'
import type { ProjectViewContext } from './types'
import { ProjectsMainHeader } from '@/layers/index/projects'

defineOptions({ name: 'ProjectView' })
const props = defineProps<{ projectId: string }>()

const projectStore = useProjectStore()

const currentProject = computed<Project>(() => {
    const project = projectStore.projects.find((p) => p.id === props.projectId)
    return project as Project
})

provide<ProjectViewContext>('projectViewContext', {
    currentProject: currentProject
})
</script>
