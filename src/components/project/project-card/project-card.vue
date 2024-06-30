<template>
    <nue-div class="project-card" vertical theme="card" flex width="30%" @click="handleGoToProject">
        <nue-div vertical gap="4px">
            <nue-text size="16px">{{ project.name }}</nue-text>
            <nue-text size="12px" color="gray">
                {{ project.description || 'No description' }}
            </nue-text>
        </nue-div>
        <nue-div style="margin-top: 36px" gap="6px">
            <nue-button theme="small">Study</nue-button>
            <nue-button theme="small">UI Design</nue-button>
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
import type { Project } from '@/stores/use-project-store'
import { useRouter } from 'vue-router'

const router = useRouter()

defineOptions({ name: 'ProjectCard' })
const props = defineProps<{ project: Project }>()

function handleGoToProject() {
    router.push({ name: 'project-main', params: { projectId: props.project.id } })
}
</script>

<style scoped>
.project-card {
    &:hover {
        background-color: #f5f5f5;
        cursor: pointer;
    }
}
</style>
