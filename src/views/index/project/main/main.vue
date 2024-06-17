<template>
    <project-not-found v-if="!currentProject" />
    <template v-else>
        <nue-div vertical wrap="nowrap" height="100%">
            <project-header
                :project="currentProject"
                @delete-project="handleDeleteProject"
                @add-description="handleAddDescription"
            ></project-header>
            <nue-divider></nue-divider>
            <router-view :key="currentProject.id"></router-view>
        </nue-div>
    </template>
</template>

<script setup lang="ts">
import { ref, computed, provide, onMounted } from 'vue'
import { useProjectStore, type Project } from '@/stores/useProjectStore'
import { findOne } from '@/utils/utils'
import ProjectNotFound from '@/components/project/project-not-found.vue'
import { NueMessage } from 'nue-ui'
import type { ProjectViewContext } from '../types'
import { useRouter } from 'vue-router'
import { ProjectHeader } from '@/layers/index'

defineOptions({ name: 'ProjectView' })
const props = withDefaults(defineProps<{ projectId: string }>(), {})

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
        () => NueMessage.success('Project deleted successfully'),
        (err) => NueMessage.error(err)
    )
}

function handleAddDescription(description: Project['description']) {
    projectStore.update(currentProject.value.id, { description }).then(
        () => NueMessage.success('Project description updated successfully'),
        (err) => NueMessage.error(err)
    )
}

provide<ProjectViewContext>('projectViewContext', {
    projectId: props.projectId,
    currentProject: currentProject.value
})
</script>

<style scoped></style>
