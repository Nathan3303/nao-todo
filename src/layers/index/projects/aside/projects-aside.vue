<template>
    <nue-div class="app-aside" vertical align="stretch" flex>
        <!-- Mainly links -->
        <nue-div vertical gap="8px" align="stretch">
            <nue-link theme="btnlike" icon="board" :route="{ name: 'project-dashboard' }">
                仪表盘(Dashboard)
            </nue-link>
        </nue-div>

        <!-- Category collapse -->
        <nue-collapse v-model="collapseItemsRecord">
            <!-- Projects collapse -->
            <nue-collapse-item name="projects">
                <template #header="{ collapse, state }">
                    <nue-button
                        theme="pure"
                        :icon="state ? 'arrow-right' : 'arrow-down'"
                        @click="collapse"
                    >
                        <template #default>
                            <nue-div>
                                <nue-text size="12px">项目清单</nue-text>
                                <nue-text size="12px" color="gray">
                                    {{ projects.length }}
                                </nue-text>
                            </nue-div>
                        </template>
                    </nue-button>
                    <nue-button
                        theme="pure"
                        icon="plus"
                        @click.stop="showCreateProjectDialog"
                    ></nue-button>
                </template>
                <nue-link
                    theme="btnlike"
                    v-for="project in projects"
                    :key="project.id"
                    :route="{ name: 'project-main', params: { projectId: project.id } }"
                >
                    {{ project.name }}
                </nue-link>
            </nue-collapse-item>
        </nue-collapse>

        <!-- Add project dialog -->
        <create-project-dialog
            ref="createProjectDialogRef"
            @create="handleCreateProject"
        ></create-project-dialog>
    </nue-div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useProjectStore, type Project } from '@/stores/use-project-store'
import { NueMessage, NuePrompt } from 'nue-ui'
import { storeToRefs } from 'pinia'
import { CreateProjectDialog, type NewProjectPayload } from '@/components/project'

const projectStore = useProjectStore()

const { projects } = storeToRefs(projectStore)
const collapseItemsRecord = ref(['projects'])
const createProjectDialogRef = ref<InstanceType<typeof CreateProjectDialog>>()

const showCreateProjectDialog = () => {
    createProjectDialogRef.value?.show()
}

const handleCreateProject = async (payload: NewProjectPayload) => {
    await projectStore.createProject({
        name: payload.name,
        description: payload.description
    })
}
</script>
