<template>
    <nue-div class="project-card" vertical theme="card" @click="handleClick">
        <nue-div vertical gap="4px" flex>
            <nue-div align="center" justify="space-between">
                <nue-text size="16px">{{ project.title }}</nue-text>
                <nue-div align="center" width="fit-content">
                    <slot name="ops"></slot>
                </nue-div>
            </nue-div>
            <nue-text size="12px" color="gray">
                {{ project.description || 'No description' }}
            </nue-text>
        </nue-div>
        <nue-divider></nue-divider>
        <nue-div wrap="nowrap">
            <nue-text size="12px" color="gray">4/16</nue-text>
            <nue-text size="12px" flex align="center">NueProgress</nue-text>
            <nue-text size="12px">100%</nue-text>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { useProjectCard } from './use-project-card'
import type { ProjectCardProps, ProjectCardEmits } from './types'

defineOptions({ name: 'ProjectCard' })
const props = defineProps<ProjectCardProps>()
const emit = defineEmits<ProjectCardEmits>()

const { handleClick } = useProjectCard(props, emit)
</script>

<style scoped>
.project-card {
    &:hover {
        background-color: #f5f5f5;
        cursor: pointer;
    }
}
</style>
