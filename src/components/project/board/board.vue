<template>
    <div class="project-board-wrapper">
        <loading v-show="loadingState"></loading>
        <div class="project-board">
            <slot>
                <empty :empty="isEmpty"></empty>
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
            </slot>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import {
    Loading,
    Empty,
    ProjectCard,
    ProjectArchiveButton,
    ProjectDeleteButton
} from '@/components'
import type { ProjectBoardProps, ProjectBoardEmits } from './types'
import type { Project } from '@/stores'

defineOptions({ name: 'ProjectBoard' })
const props = defineProps<ProjectBoardProps>()
const emit = defineEmits<ProjectBoardEmits>()

const slots = useSlots()

const isEmpty = computed(() => {
    const { projects } = props
    if (!projects) return true
    return !projects.length && !slots.default
})
</script>

<style scoped>
@import url(./board.css);
</style>
