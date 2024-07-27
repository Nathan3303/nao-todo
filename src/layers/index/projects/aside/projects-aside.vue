<template>
    <nue-div class="app-aside" vertical align="stretch" flex>
        <nue-div vertical gap="8px" align="stretch">
            <nue-link theme="btnlike" icon="board" :route="{ name: 'project-dashboard' }">
                我的清单
            </nue-link>
            <!-- <nue-link theme="btnlike" icon="archive2" :route="{ name: 'project-archived' }">
                已归档
            </nue-link> -->
            <nue-link theme="btnlike" icon="inbox" disabled> 收集箱 </nue-link>
        </nue-div>
        <nue-collapse v-model="collapseItemsRecord" style="margin-bottom: auto">
            <nue-collapse-item name="projects">
                <template #header="{ collapse, state }">
                    <nue-button
                        theme="pure"
                        :icon="state ? 'arrow-right' : 'arrow-down'"
                        @click="collapse"
                    >
                        <template #default>
                            <nue-div>
                                <nue-text size="12px">清单</nue-text>
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
        <nue-div vertical gap="8px" align="stretch">
            <nue-link theme="btnlike" icon="delete" :route="{ name: 'project-recycle-bin' }">
                垃圾桶
            </nue-link>
            <nue-divider></nue-divider>
            <nue-link theme="btnlike" icon="setting" disabled> 设置 </nue-link>
        </nue-div>
        <create-project-dialog
            ref="createProjectDialogRef"
            @create="handleCreateProject"
        ></create-project-dialog>
    </nue-div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '@/stores'
import { CreateProjectDialog } from '@/components'
import { storeToRefs } from 'pinia'
import type { NewProjectPayload } from '@/components'

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
</style>
