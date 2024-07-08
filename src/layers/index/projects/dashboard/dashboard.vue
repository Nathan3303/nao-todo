<template>
    <nue-div vertical>
        <nue-text theme="h3">My Recent Projects</nue-text>
        <empty :empty="!projects.length" align="left">
            <nue-div>
                <project-card
                    v-for="project in projects"
                    :key="project.id"
                    :project="project"
                ></project-card>
            </nue-div>
        </empty>
    </nue-div>
</template>

<script setup lang="ts">
import type { Project } from '@/stores/use-project-store'
import { ProjectCard, Empty } from '@/components'

defineOptions({ name: 'ProjectsDashboard' })
defineProps<{ projects: Project[] }>()
</script>

<style scoped></style>
