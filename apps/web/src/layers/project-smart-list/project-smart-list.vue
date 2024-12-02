<template>
    <nue-collapse-item name="projects">
        <template #header="{ collapse, state }">
            <nue-button theme="pure" :icon="state ? 'arrow-right' : 'arrow-down'" @click="collapse">
                <template #default>
                    <nue-div>
                        <nue-text size="12px">清单</nue-text>
                        <nue-text size="12px" color="gray"> {{ projects.length }}</nue-text>
                    </nue-div>
                </template>
            </nue-button>
            <nue-div width="fit-content" gap="8px">
                <nue-tooltip size="small" content="打开清单管理器">
                    <nue-button theme="pure" icon="setting" @click.stop="showProjectManageDialog" />
                </nue-tooltip>
                <nue-tooltip size="small" content="创建新清单">
                    <nue-button
                        id="create-project-btn"
                        theme="pure"
                        icon="plus"
                        @click.stop="showCreateProjectDialog"
                    />
                </nue-tooltip>
            </nue-div>
        </template>
        <template v-if="projects && projects.length">
            <aside-link
                v-for="project in projects"
                icon="more2"
                :key="project.id"
                :route="{ name: 'tasks-project', params: { projectId: project.id } }"
            >
                {{ project.title }}
            </aside-link>
        </template>
        <nue-text v-else class="nue-collapse-item__empty-text" size="11px" color="#a5a5a5">
            用清单来分类收集、组织和管理你的待办任务。
        </nue-text>
    </nue-collapse-item>
    <!-- Dialogs -->
    <create-project-dialog ref="createProjectDialogRef" :handler="handleCreateProject" />
    <project-manager ref="projectManagerRef" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { ProjectManager } from '../project-manager'
import { CreateProjectDialog } from '@/layers'
import { useProjectStore } from '@/stores'
import { AsideLink } from '@nao-todo/components'
import type { CreateProjectOptions } from '@nao-todo/types'

defineOptions({ name: 'ProjectSmartList' })

const projectStore = useProjectStore()

const { smartListData: projects } = storeToRefs(projectStore)
const createProjectDialogRef = ref<InstanceType<typeof CreateProjectDialog>>()
const projectManagerRef = ref<InstanceType<typeof ProjectManager>>()

const showCreateProjectDialog = () => createProjectDialogRef.value?.show()
const showProjectManageDialog = () => projectManagerRef.value?.show()

const handleCreateProject = async (payload: CreateProjectOptions) => {
    return await projectStore.doCreateProject(payload)
}
</script>
