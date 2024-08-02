<template>
    <nue-container class="project-archived-view">
        <nue-header>
            <nue-text theme="h3">已归档的项目</nue-text>
        </nue-header>
        <nue-main>
            <project-board :loading-state="projectBoardLoading">
                <project-card
                    v-for="project in archivedProjects"
                    :key="project.id"
                    :project="project"
                >
                    <template #ops>
                        <tooltip content="取消归档" align="right">
                            <nue-button
                                theme="pure,unarchived"
                                icon="archive"
                                @click="handleUnarchiveProject(project.id)"
                            ></nue-button>
                        </tooltip>
                    </template>
                </project-card>
            </project-board>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '@/stores'
import { ProjectBoard, ProjectCard, Tooltip } from '@/components'
import { NueMessage, NueConfirm } from 'nue-ui'
import type { Project } from '@/stores'

const projectStore = useProjectStore()

const { archivedProjects } = storeToRefs(projectStore)
const projectBoardLoading = ref(false)

const handleGetArchivedProjects = async () => {
    projectBoardLoading.value = true
    await projectStore.getArchivedProjects()
    projectBoardLoading.value = false
}

const handleUnarchiveProject = async (projectId: Project['id']) => {
    NueConfirm({
        title: '取消项目归档确认',
        content: '确定要取消项目归档吗？',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
    }).then(
        async () => {
            console.log('unarchive project', projectId)
            await projectStore.unarchiveProject(projectId)
        },
        () => NueMessage.info('操作取消')
    )
}

await handleGetArchivedProjects()
</script>

<style scoped>
.project-archived-view {
    gap: 16px;

    .nue-header {
        padding: 0px;
        height: auto;
        border-bottom: none;
    }

    .nue-main {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        padding: 0px;

        .nue-button--unarchived:deep(.nue-icon)::after {
            display: block;
            width: 100%;
            height: 2px;
            background-color: #007aff;
            content: '';
            position: absolute;
            transform: rotate(45deg);
            top: 4px;
            left: 1px;
        }
    }
}
</style>
