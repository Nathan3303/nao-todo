<template>
    <nue-div>
        <nue-text theme="h3">My Recent Projects</nue-text>
        <nue-div>
            <project-card
                v-for="project in projects"
                :key="project.id"
                :project="project"
            ></project-card>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import type { Project } from '@/stores/use-project-store'
import { ProjectCard } from '@/components'

defineProps<{ projects: Project[] }>()
</script>

<style scoped></style>
