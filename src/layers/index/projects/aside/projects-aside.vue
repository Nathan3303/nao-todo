<template>
    <nue-div class="app-aside" vertical align="stretch" flex>
        <!-- 顶部菜单 -->
        <nue-div vertical gap="8px" align="stretch">
            <nue-link theme="btnlike" icon="board" :route="{ name: 'project-dashboard' }">
                仪表盘
            </nue-link>
            <nue-link theme="btnlike" icon="board" disabled> 收集箱 </nue-link>
        </nue-div>

        <!-- 清单列表 -->
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
                        id="create-project-btn"
                        theme="pure"
                        icon="plus"
                        @click.stop="showCreateProjectDialog"
                    ></nue-button>
                </template>
                <nue-link
                    theme="btnlike,plink"
                    v-for="project in projects"
                    :key="project.id"
                    :route="{ name: 'project-main', params: { projectId: project.id } }"
                    icon="more2"
                >
                    {{ project.title }}
                </nue-link>
            </nue-collapse-item>
        </nue-collapse>

        <!-- 底部菜单 -->
        <nue-div vertical gap="8px" align="stretch" style="margin-top: auto">
            <nue-link theme="btnlike" icon="success" disabled> 已完成 </nue-link>
            <nue-link theme="btnlike" icon="delete" disabled> 回收站 </nue-link>
            <nue-divider></nue-divider>
            <nue-link theme="btnlike" icon="setting" disabled> 设置 </nue-link>
        </nue-div>

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
import { CreateProjectDialog, type NewProjectPayload } from '@/components/project'
import { NueMessage, NuePrompt } from 'nue-ui'
import { storeToRefs } from 'pinia'

const projectStore = useProjectStore()

const { projects } = storeToRefs(projectStore)
const collapseItemsRecord = ref(['projects'])
const createProjectDialogRef = ref<InstanceType<typeof CreateProjectDialog>>()

const showCreateProjectDialog = () => {
    createProjectDialogRef.value?.show()
}

const handleCreateProject = async (payload: NewProjectPayload) => {
    await projectStore.createProject({
        title: payload.name,
        description: payload.description
    })
    createProjectDialogRef.value?.clear()
}
</script>

<style scoped>
.nue-link--plink {
    overflow: hidden;

    &:deep(span) {
        text-align: left;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

.nue-link--disabled {
    opacity: 0.6;
    background-color: #f5f5f5;
}
</style>
