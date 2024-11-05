<template>
    <nue-container class="project-content">
        <nue-header class="project-content__header">
            <nue-div align="center" height="36px" wrap="nowrap" style="overflow: auto">
                <nue-div class="project-content__header__title" gap="4px">
                    <nue-button
                        theme="icon-only"
                        :icon="pav ? 'menu-close' : 'menu-open'"
                        @click="viewStore.toggleProjectAsideVisible()"
                    />
                    <nue-text size="23px"> {{ title }} </nue-text>
                </nue-div>
                <nue-div class="project-content__header__actions">
                    <slot name="actions"></slot>
                    <nue-button theme="icon-only" icon="setting" />
                </nue-div>
            </nue-div>
            <nue-text size="14px" color="gray" v-if="$slots.subTitle || subTitle">
                <slot name="subTitle"> {{ subTitle }} </slot>
            </nue-text>
        </nue-header>
        <nue-container class="project-content__main">
            <nue-header class="project-content__main__header">
                <project-filter-bar :filter-info="filterInfo" />
                <nue-button
                    theme="primary,small"
                    icon="plus"
                    @click="handleShowCreateProjectDialog"
                >
                    创建清单
                </nue-button>
            </nue-header>
            <project-board
                :projects="projects"
                allow-route
                @archive-project="handleArchiveProject"
                @unarchive-project="handleUnarchiveProject"
                @delete-project="handleDeleteProject"
                @restore-project="handleRestoreProject"
            />
        </nue-container>
    </nue-container>
    <create-project-dialog
        ref="createProjectDialogRef"
        :handler="createProject"
    ></create-project-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useViewStore, useProjectStore } from '@nao-todo/stores'
import { ProjectFilterBar, ProjectBoard, CreateProjectDialog } from '@nao-todo/components'
import {
    getProjects,
    createProject,
    handleArchiveProject,
    handleUnarchiveProject,
    handleDeleteProject,
    handleRestoreProject
} from '@nao-todo/handlers/project-handlers'
import type { ProjectContentProps } from './types'

defineOptions({ name: 'ProjectContent' })
const props = withDefaults(defineProps<ProjectContentProps>(), {
    title: '未知板块'
})

const viewStore = useViewStore()
const projectStore = useProjectStore()

const { projectAsideVisible: pav } = storeToRefs(viewStore)
const { projects } = storeToRefs(projectStore)
const createProjectDialogRef = ref<InstanceType<typeof CreateProjectDialog>>()

const handleShowCreateProjectDialog = () => {
    createProjectDialogRef.value?.show()
}

await getProjects(props.filterInfo)
</script>

<style scoped>
@import url('./content.css');
</style>
