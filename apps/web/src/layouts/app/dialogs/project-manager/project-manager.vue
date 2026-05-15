<script lang="ts" setup>
import {
    type DialogInstanceType,
    useDialogWrapper,
    ProjectBoard,
    ProjectDeleteButton
} from '@nao-todo/components'
import { onMounted, ref } from 'vue'
import useProjectManager from './use-project-manager'
import { PROJECT_MANAGER_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'

defineOptions({ name: 'ProjectManager' })

// 项目管理器对话框实例
const dialogRef = ref<DialogInstanceType>()

// 项目管理器
const {
    states,
    filteredProjects,
    loadingProjects,
    dialogManager,
    setActiveTab,
    deleteProject,
    restoreProject,
    openProjectCreatorDialog
} = useProjectManager()

// 对话框实例
const { visible, close } = useDialogWrapper(dialogRef)

// @Mounted
onMounted(() => {
    // 注册项目管理器
    dialogManager.register(PROJECT_MANAGER_DIALOG_KEY, {
        open: () => {
            visible.value = true
        },
        close
    })
})
</script>

<template>
    <nue-dialog v-model="visible" ref="dialogRef" theme="fullscreen" title="清单管理">
        <nue-container id="ProjectManager" theme="in-dialog">
            <nue-header class="project-manager-header">
                <nue-div align="center" gap="0.75rem">
                    <nue-button-group>
                        <nue-button
                            :theme="states.activeTab === 'all' ? 'primary,small' : 'small'"
                            @click="setActiveTab('all')"
                        >
                            全部
                        </nue-button>
                        <nue-button
                            :theme="states.activeTab === 'active' ? 'primary,small' : 'small'"
                            @click="setActiveTab('active')"
                        >
                            正常
                        </nue-button>
                        <nue-button
                            :theme="states.activeTab === 'deleted' ? 'primary,small' : 'small'"
                            @click="setActiveTab('deleted')"
                        >
                            已删除
                        </nue-button>
                    </nue-button-group>
                    <nue-divider vertical />
                    <nue-input
                        v-model="states.filterInfo.name"
                        icon="search"
                        theme="small"
                        clearable
                        placeholder="搜索清单"
                        style="width: 200px"
                    />
                </nue-div>
                <nue-div align="center" gap="0.75rem">
                    <nue-tooltip
                        size="small"
                        theme="warning"
                        content="删除的清单会在 30 天后永久删除，所有归属于该清单的任务也会被永久删除，切记删除清单时再次考虑。如果是不想在智能列表中显示该清单，可以使用归档功能。"
                        placement="bottom-center"
                    >
                        <nue-div align="center" gap="0.25rem" class="warning-trigger">
                            <nue-icon name="warning" size="14px" />
                            <nue-text size="12px">删除功能重要提醒</nue-text>
                        </nue-div>
                    </nue-tooltip>
                    <nue-divider vertical />
                    <nue-button
                        icon="plus-circle"
                        theme="small,primary"
                        @click="openProjectCreatorDialog"
                    >
                        新增清单
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
                    >
                        <template #ops="{ project }">
                            <project-delete-button
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

