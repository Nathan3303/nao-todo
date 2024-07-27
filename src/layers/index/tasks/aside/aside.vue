<template>
    <nue-container class="tasks-view-aside">
        <nue-header>
            <aside-link icon="more2" :route="{ name: 'tasks-all' }"> 所有 </aside-link>
            <aside-link icon="calendar2" :route="{ name: 'tasks-today' }"> 今天 </aside-link>
            <aside-link icon="tomorrow2" :route="{ name: 'tasks-tomorrow' }"> 明天 </aside-link>
            <aside-link icon="week" :route="{ name: 'tasks-week' }"> 最近 7 天 </aside-link>
            <aside-link icon="inbox" :route="{ name: 'tasks-inbox' }"> 收集箱 </aside-link>
        </nue-header>
        <nue-main>
            <nue-collapse v-model="collapseItemsRecord">
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
                    <aside-link
                        v-for="project in projects"
                        icon="more2"
                        :key="project.id"
                        :route="{ name: 'tasks-project', params: { projectId: project.id } }"
                    >
                        {{ project.title }}
                    </aside-link>
                </nue-collapse-item>
            </nue-collapse>
        </nue-main>
        <nue-footer>
            <aside-link icon="delete" :route="{ name: 'tasks-recycle' }"> 垃圾桶 </aside-link>
            <nue-divider></nue-divider>
            <aside-link icon="setting" disabled> 设置 </aside-link>
        </nue-footer>
    </nue-container>
    <create-project-dialog
        ref="createProjectDialogRef"
        @create="handleCreateProject"
    ></create-project-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { CreateProjectDialog, AsideLink } from '@/components'
import type { NewProjectPayload } from '@/components'

defineOptions({ name: 'TasksViewAside' })

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
@import url('./aside.css');
</style>
