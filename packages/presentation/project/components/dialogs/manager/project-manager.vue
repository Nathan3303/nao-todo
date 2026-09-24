<script lang="ts" setup>
import {
    type DialogInstanceType,
    useDialogWrapper
} from '@nao-todo/shared/components/dialog-wrapper'
import { PROJECT_MANAGER_DIALOG_KEY } from '@nao-todo/shared/constants'
import { t } from '@nao-todo/shared/locales'
import { ProjectBoard } from '@nao-todo/shared/components/project-board'
import { ProjectArchiveButton } from '@nao-todo/shared/components/project-archive-button'
import { ProjectDeleteButton } from '@nao-todo/shared/components/project-delete-button'
import { RuleHint } from '@nao-todo/shared/components/rule-hint'
import { onMounted, ref } from 'vue'
import type { ProjectManagerDialogProps, ProjectManagerVO } from './types'
import useProjectManager from './use-project-manager'

defineOptions({ name: 'ProjectManager' })
const props = defineProps<ProjectManagerDialogProps>()

// 项目管理器对话框实例
const dialogRef = ref<DialogInstanceType>()

// 项目管理器
const {
    states,
    displayProjects,
    loadingProjects,
    setActiveTab,
    deleteProject,
    restoreProject,
    unarchiveProject,
    openProjectCreatorDialog
} = useProjectManager(props)

// 对话框实例
const { visible, close } = useDialogWrapper(dialogRef)

// 打开项目管理器对话框（可选指定初始 tab，供侧栏「已归档」入口直达）
const open = (payload?: { activeTab?: ProjectManagerVO['activeTab'] }) => {
    if (payload?.activeTab) setActiveTab(payload.activeTab)
    visible.value = true
}

// @Mounted
onMounted(() => {
    // 注册项目管理器
    props.dialogManager.register(PROJECT_MANAGER_DIALOG_KEY, { open, close })
})
</script>

<template>
    <nue-dialog
        v-model="visible"
        ref="dialogRef"
        theme="large"
        :title="t('dialog.projectManager.title')"
    >
        <nue-container id="ProjectManager" theme="in-dialog">
            <rule-hint
                icon="priority-2"
                :title="t('dialog.projectManager.deleteReminder')"
                :content="t('dialog.projectManager.deleteWarning')"
                variant="warning"
            />
            <nue-header class="project-manager-header">
                <nue-div align="center" gap="0.75rem">
                    <nue-button-group>
                        <nue-button
                            :theme="states.activeTab === 'all' ? 'primary,small' : 'small'"
                            @click="setActiveTab('all')"
                        >
                            {{ t('common.all') }}
                        </nue-button>
                        <nue-button
                            :theme="states.activeTab === 'active' ? 'primary,small' : 'small'"
                            @click="setActiveTab('active')"
                        >
                            {{ t('common.normal') }}
                        </nue-button>
                        <nue-button
                            :theme="states.activeTab === 'deleted' ? 'primary,small' : 'small'"
                            @click="setActiveTab('deleted')"
                        >
                            {{ t('common.deleted') }}
                        </nue-button>
                        <nue-button
                            :theme="states.activeTab === 'archived' ? 'primary,small' : 'small'"
                            @click="setActiveTab('archived')"
                        >
                            {{ t('common.archived') }}
                        </nue-button>
                    </nue-button-group>
                    <nue-divider vertical />
                    <nue-input
                        v-model="states.filterInfo.name"
                        icon="search"
                        theme="small"
                        clearable
                        :placeholder="t('dialog.projectManager.searchPlaceholder')"
                        style="width: 200px"
                    />
                </nue-div>
                <nue-button
                    icon="plus-circle"
                    theme="small,primary"
                    @click="openProjectCreatorDialog"
                >
                    {{ t('dialog.projectManager.createNew') }}
                </nue-button>
            </nue-header>
            <nue-divider />
            <nue-main>
                <nue-content fill style="overflow: hidden">
                    <project-board
                        :projects="displayProjects"
                        @delete-project="deleteProject"
                        @restore-project="restoreProject"
                    >
                        <template #ops="{ project }">
                            <project-archive-button
                                v-if="project.isArchived && !project.isDeleted"
                                :is-archived="true"
                                :loading="loadingProjects.get(project.id)"
                                @unarchive="unarchiveProject(project.id)"
                            />
                            <project-delete-button
                                v-else
                                :is-deleted="project.isDeleted"
                                :loading="loadingProjects.get(project.id)"
                                @delete="deleteProject(project.id)"
                                @restore="restoreProject(project.id)"
                            />
                        </template>
                    </project-board>
                </nue-content>
            </nue-main>
        </nue-container>
    </nue-dialog>
</template>

<style scoped>
#ProjectManager {
    .project-manager-header {
        border: none;
        height: auto;
        justify-content: space-between;
        flex-wrap: wrap;
    }

    .warning-trigger {
        cursor: default;
        color: var(--nue-warning-color-60);
    }
}
</style>

<style>
.nue-tooltip.nue-tooltip--warning {
    background-color: var(--nue-warning-color-10);
    padding: var(--nue-padding-sm);

    > .nue-tooltip__text {
        font-size: var(--nue-text-sm);
        color: var(--nue-warning-color-60);
    }
}
</style>