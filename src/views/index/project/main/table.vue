<template>
    <projects-main-list :project-id="project.id"></projects-main-list>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { ProjectsMainList } from '@/layers/index/projects'
import type { ProjectViewContext } from './types'

const { currentProject: project } = inject('projectViewContext') as ProjectViewContext
</script>
