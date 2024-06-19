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
import { useProjectStore, type Project } from '@/stores/useProjectStore'
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

function handleDeleteProject() {
    projectStore.remove(currentProject.value.id).then(
        () => {
            NueMessage.success('Project deleted successfully')
            router.push({
                name: 'project-main',
                params: { projectId: projectStore.projects[0].id }
            })
        },
        (err) => NueMessage.error(err)
    )
}

function handleEditName(name: Project['name']) {
    projectStore.update(currentProject.value.id, { name }).then(
        () => NueMessage.success('Project name updated successfully'),
        (err) => NueMessage.error(err)
    )
}

function handleEditDescription(description: Project['description']) {
    projectStore.update(currentProject.value.id, { description }).then(
        () => NueMessage.success('Project description updated successfully'),
        (err) => NueMessage.error(err)
    )
}

provide<ProjectViewContext>('projectViewContext', {
    currentProject: currentProject
})
</script>
