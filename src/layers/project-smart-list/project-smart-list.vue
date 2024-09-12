<template>
    <nue-collapse-item name="projects">
        <template #header="{ collapse, state }">
            <nue-button theme="pure" :icon="state ? 'arrow-right' : 'arrow-down'" @click="collapse">
                <template #default>
                    <nue-div>
                        <nue-text size="12px">智能清单</nue-text>
                        <nue-text size="12px" color="gray"> {{ projects.length }} / 99 </nue-text>
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
        <nue-empty v-else description="暂无清单" />
    </nue-collapse-item>
    <create-project-dialog ref="createProjectDialogRef" :handler="createProject" />
    <project-manager ref="projectManagerRef" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ProjectManager from '../project-manager/project-manager.vue'
import { CreateProjectDialog, AsideLink } from '@/components'
import { createProject } from '@/utils/project-handlers'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '@/stores'

defineOptions({ name: 'ProjectSmartList' })

const projectStore = useProjectStore()

const { smartListData: projects } = storeToRefs(projectStore)
const createProjectDialogRef = ref<InstanceType<typeof CreateProjectDialog>>()
const projectManagerRef = ref<InstanceType<typeof ProjectManager>>()

const showCreateProjectDialog = () => {
    createProjectDialogRef.value?.show()
}

const showProjectManageDialog = () => {
    projectManagerRef.value?.show()
}

</script>

<style scoped>
@import url('./project-smart-list.css');
</style>
