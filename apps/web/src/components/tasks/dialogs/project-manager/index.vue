<script lang="ts" setup>
import { ProjectBoard } from '@nao-todo/components/project'
import { type DialogInstanceType, useDialogWrapper } from '@/components/ui/dialog-wrapper'
import { onMounted, ref } from 'vue'
import type { ProjectManagerEmits, ProjectManagerProps } from './types'
import useProjectManager from './use-project-manager'

defineOptions({ name: 'ProjectManager' })
const props = defineProps<ProjectManagerProps>()
const emit = defineEmits<ProjectManagerEmits>()

const dialogRef = ref<DialogInstanceType>()

const { states, filteredProjects, deleteProject, restoreProject, hardDeleteProject } =
    useProjectManager(props, emit)
const { visible, close } = useDialogWrapper(dialogRef)

const open = () => (visible.value = true)

onMounted(() => emit('register', open, close))
</script>

<template>
    <nue-dialog v-model="visible" ref="dialogRef" theme="large">
        <template #header>
            <nue-text>清单管理</nue-text>
            <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
        </template>
        <nue-container id="ProjectManager" theme="in-dialog">
            <nue-header>
                <nue-div align="center" width="fit-content">
                    <nue-input
                        v-model="states.filterInfo.name"
                        icon="filter"
                        theme="small"
                        clearable
                        placeholder="筛选清单"
                    />
                    <nue-checkbox v-model="states.filterInfo.onlyDeleted" theme="small">只看已删除</nue-checkbox>
                </nue-div>
                <nue-div gap="12px" width="fit-content" style="margin-left: auto">
                    <nue-button
                        icon="plus-circle"
                        theme="small,primary"
                        @click="projectCreatorOpener"
                    >
                        新增
                    </nue-button>
                </nue-div>
            </nue-header>
            <nue-divider />
            <nue-main>
                <nue-content fill style="overflow: hidden">
                    <project-board
                        :projects="filteredProjects"
                        @delete-project="deleteProject"
                        @restore-project="restoreProject"
                        @delete-project-permanently="hardDeleteProject"
                    />
                </nue-content>
            </nue-main>
        </nue-container>
    </nue-dialog>
</template>
