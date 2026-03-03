<script setup lang="ts">
import { Loading } from '../loading'
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
        <nue-empty v-else-if="!projects || !projects.length" style="height: 100%" />
        <template v-else>
            <div class="project-board">
                <project-card
                    v-for="project in projects"
                    :key="project.id"
                    :project="project"
                    :allow-route="allowRoute"
                >
                    <template #ops>
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

        .project-board__delete-permanently .nue-button--pure {
            color: red;
        }
    }
}
</style>
