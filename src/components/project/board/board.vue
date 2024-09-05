<template>
    <div class="project-board-wrapper">
        <loading v-if="loadingState" />
        <template v-else-if="projects">
            <div class="project-board">
                <project-card
                    v-for="project in projects"
                    :key="project.id"
                    :project="project"
                    :allow-route="allowRoute"
                >
                    <template #ops>
                        <project-archive-button
                            :is-archived="project.isArchived"
                            @archive="emit('archiveProject', project.id)"
                            @unarchive="emit('unarchiveProject', project.id)"
                        />
                        <project-delete-button
                            :is-deleted="project.isDeleted"
                            @delete="emit('deleteProject', project.id)"
                            @resotre="emit('restoreProject', project.id)"
                        />
                    </template>
                </project-card>
            </div>
        </template>
        <nue-empty v-else />
    </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { Loading, ProjectCard, ProjectArchiveButton, ProjectDeleteButton } from '@/components'
import type { ProjectBoardProps, ProjectBoardEmits } from './types'

defineOptions({ name: 'ProjectBoard' })
const props = defineProps<ProjectBoardProps>()
const emit = defineEmits<ProjectBoardEmits>()

const slots = useSlots()
</script>

<style scoped>
@import url(./board.css);
</style>
