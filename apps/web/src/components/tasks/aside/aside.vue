<script setup lang="ts">
import { ProjectSmartList } from '@nao-todo/presentation/project'
import { TagSmartList } from '@nao-todo/presentation/tag'
import {
    PROJECT_CREATOR_DIALOG_KEY,
    PROJECT_MANAGER_DIALOG_KEY,
    TAG_CREATOR_DIALOG_KEY,
    TAG_MANAGER_DIALOG_KEY
} from '@nao-todo/shared'
import dayjs from 'dayjs'
import { useAside } from './use-aside'

defineOptions({ name: 'TasksViewAside' })

const {
    builtInProjectLinks,
    projectLinks,
    tagLinks,
    handleProjectResort,
    handleTagResort,
    collapseItemsRecord,
    dialogManager,
    isDisplayAside
} = useAside()
</script>

<template>
    <teleport v-if="isDisplayAside" to="#SubPageAsideTeleportSlot">
        <nue-div theme="aside-wrapper">
            <nue-div vertical gap="0.25rem">
                <nue-link
                    v-for="link in builtInProjectLinks.slice(0, 5)"
                    :key="link.id"
                    :icon="link.icon"
                    :route="{ name: 'tasks-built-in-project', params: { projectId: link.id } }"
                    theme="route"
                >
                    {{ link.title }}
                    <template #append>
                        <nue-text :clamped="1">
                            {{ link.id === 'today' ? dayjs().format('M月D日') : '' }}
                        </nue-text>
                    </template>
                </nue-link>
            </nue-div>
            <nue-divider />
            <nue-collapse theme="menu" v-model="collapseItemsRecord">
                <project-smart-list
                    :links="projectLinks"
                    draggable
                    @open-project-creator="() => dialogManager.open(PROJECT_CREATOR_DIALOG_KEY)"
                    @open-project-manager="() => dialogManager.open(PROJECT_MANAGER_DIALOG_KEY)"
                    @resort="handleProjectResort"
                />
                <tag-smart-list
                    :links="tagLinks"
                    draggable
                    @open-tag-creator="() => dialogManager.open(TAG_CREATOR_DIALOG_KEY)"
                    @open-tag-manager="() => dialogManager.open(TAG_MANAGER_DIALOG_KEY)"
                    @resort="handleTagResort"
                />
            </nue-collapse>
            <nue-divider />
            <nue-div vertical gap="0.25rem">
                <nue-link
                    v-for="link in builtInProjectLinks.slice(5, builtInProjectLinks.length)"
                    :key="link.id"
                    :icon="link.icon"
                    :route="{ name: 'tasks-built-in-project', params: { projectId: link.id } }"
                    theme="route"
                >
                    {{ link.title }}
                </nue-link>
            </nue-div>
        </nue-div>
    </teleport>
</template>

<style scoped>
.nue-div--block {
    flex-direction: column;
    gap: 0.5rem;
}

.nue-collapse--menu {
    gap: 0;

    .nue-collapse-item {
        border: none;
    }
}
</style>
