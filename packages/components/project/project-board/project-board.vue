<script setup lang="ts">
import { Loading } from '../../loading'
import { ProjectCard } from '../project-card'
import { ProjectDeleteButton } from '../project-delete-button'
import type { ProjectBoardProps, ProjectBoardEmits } from './types'

defineOptions({ name: 'ProjectBoard' })
withDefaults(defineProps<ProjectBoardProps>(), { allowRoute: false })
const emit = defineEmits<ProjectBoardEmits>()
</script>

<template>
    <div class="project-board-wrapper" style="height: 100%">
        <loading v-if="loadingState" />
        <nue-empty
            v-else-if="!projects || !projects.length"
            style="height: 100%"
            description="暂无任务清单"
        />
        <template v-else>
            <div class="project-board">
                <project-card
                    v-for="project in projects"
                    :key="project.id"
                    :project="project"
                    :allow-route="allowRoute"
                >
                    <template #ops>
                        <slot name="ops" :project="project">
                            <project-delete-button
                                :is-deleted="project.isDeleted"
                                @delete="emit('deleteProject', project.id)"
                                @restore="emit('restoreProject', project.id)"
                            />
                        </slot>
                    </template>
                </project-card>
            </div>
        </template>
    </div>
</template>

<style scoped>
.project-board-wrapper {
    overflow: unset;
    flex: 1;

    .project-board {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
        grid-gap: 12px;
        flex: auto;

        .project-card {
            height: 140px;
            overflow: hidden;
        }
    }
}
</style>

