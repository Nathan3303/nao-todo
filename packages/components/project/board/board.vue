<template>
    <div class="project-board-wrapper">
        <loading v-if="loadingState" />
        <template v-else-if="projects && projects.length">
            <div class="project-board">
                <project-card
                    v-for="project in projects"
                    :key="project.id"
                    :project="project"
                    :allow-route="allowRoute"
                >
                    <template #ops>
<!--                        <project-archive-button-->
<!--                            v-if="!project.isDeleted"-->
<!--                            :is-archived="project.isArchived"-->
<!--                            @archive="emit('archiveProject', project.id)"-->
<!--                            @unarchive="emit('unarchiveProject', project.id)"-->
<!--                        />-->
                        <project-delete-button
                            :is-deleted="project.isDeleted"
                            @delete="emit('deleteProject', project.id)"
                            @restore="emit('restoreProject', project.id)"
                        />
                        <nue-tooltip
                            v-if="project.isDeleted"
                            class="project-board__delete-permanently"
                            size="small"
                            content="永久删除清单"
                        >
                            <nue-button
                                theme="icon,ghost,pure"
                                icon="delete"
                                @click="emit('deleteProjectPermanently', project.id)"
                            />
                        </nue-tooltip>
                    </template>
                </project-card>
            </div>
        </template>
        <nue-empty v-else image-size="6rem" fill />
    </div>
</template>

<script setup lang="ts">
import {
    Loading,
    ProjectArchiveButton,
    ProjectCard,
    ProjectDeleteButton
} from '@nao-todo/components'
import type { Project } from '@nao-todo/types'

defineOptions({ name: 'ProjectBoard' })
defineProps<{
    projects?: Project[]
    loadingState?: boolean
    allowRoute?: boolean
}>()
const emit = defineEmits<{
    (event: 'archiveProject', projectId: Project['id']): void
    (event: 'unarchiveProject', projectId: Project['id']): void
    (event: 'deleteProject', projectId: Project['id']): void
    (event: 'restoreProject', projectId: Project['id']): void
    (event: 'deleteProjectPermanently', projectId: Project['id']): void
}>()
</script>

<style scoped>
.project-board-wrapper {
    overflow: unset;
    flex: 1;
}

.project-board {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
    grid-gap: 12px;
    flex: auto;
}

.project-board .project-card {
    height: 140px;
    overflow: hidden;
}

.project-board .project-board__delete-permanently .nue-button--pure {
    color: red;
}
</style>
