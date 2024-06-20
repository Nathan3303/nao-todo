<template>
    <project-not-found v-if="!currentProject" />
    <template v-else>
        <nue-div vertical wrap="nowrap" height="100%">
            <project-header
                :project="currentProject"
                @delete-project="handleDeleteProject"
                @edit-name="handleEditName"
                @edit-description="handleEditDescription"
            ></project-header>
            <nue-divider></nue-divider>
            <router-view :key="projectId"></router-view>
        </nue-div>
    </template>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue'
import { useProjectStore, type Project } from '@/stores/use-project-store'
import { findOne } from '@/utils/utils'
import ProjectNotFound from '@/components/project/project-not-found.vue'
import { NueMessage } from 'nue-ui'
import type { ProjectViewContext } from './types'
import { ProjectHeader } from '@/layers/index'
import { useRouter } from 'vue-router'

defineOptions({ name: 'ProjectView' })
const props = defineProps<{ projectId: string }>()

const router = useRouter()
const projectStore = useProjectStore()

const currentProject = computed<Project>(() => {
    return (
        findOne(projectStore.projects, (p) => {
            return p.id === props.projectId
        }) || null
    )
})

async function handleDeleteProject() {
    const { projectId } = props
    console.log(projectId)
    await projectStore.deleteProject(projectId)
}

async function handleEditName(name: Project['name']) {
    const { projectId } = props
    await projectStore.updateProject(projectId, { name })
}

async function handleEditDescription(description: Project['description']) {
    const { projectId } = props
    await projectStore.updateProject(projectId, { description })
}

provide<ProjectViewContext>('projectViewContext', {
    currentProject: currentProject
})
</script>
