<template>
    <suspense>
        <projects-main-overview :project="project"></projects-main-overview>
    </suspense>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { ProjectsMainOverview } from '@/layers/index/projects'
import type { ProjectViewContext } from './types'

const { currentProject: project } = inject('projectViewContext') as ProjectViewContext
</script>

<style scoped></style>
