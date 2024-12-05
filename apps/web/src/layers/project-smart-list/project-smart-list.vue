<template>
    <nue-collapse-item name="projects">
        <template #header="{ collapse, state }">
            <nue-button :icon="state ? 'arrow-right' : 'arrow-down'" theme="pure" @click="collapse">
                <template #default>
                    <nue-div>
                        <nue-text size="12px">清单</nue-text>
                        <nue-text color="gray" size="12px"> {{ projects.length }}</nue-text>
                    </nue-div>
                </template>
            </nue-button>
            <nue-div gap="8px" width="fit-content">
                <nue-tooltip content="打开清单管理器" size="small">
                    <nue-button
                        icon="setting"
                        theme="pure"
                        @click.stop="tasksDialogStore.showProjectManagerDialog"
                    />
                </nue-tooltip>
                <nue-tooltip content="创建新清单" size="small">
                    <nue-button
                        id="create-project-btn"
                        icon="plus"
                        theme="pure"
                        @click.stop="tasksDialogStore.showCreateProjectDialog"
                    />
                </nue-tooltip>
            </nue-div>
        </template>
        <template v-if="projects && projects.length">
            <aside-link
                v-for="project in projects"
                :key="project.id"
                :route="{ name: 'tasks-project', params: { projectId: project.id } }"
                icon="more2"
            >
                {{ project.title }}
            </aside-link>
        </template>
        <nue-text v-else class="nue-collapse-item__empty-text" color="#a5a5a5" size="11px">
            用清单来分类收集、组织和管理你的待办任务。
        </nue-text>
    </nue-collapse-item>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useProjectStore } from '@/stores'
import { AsideLink } from '@nao-todo/components'
import { useTasksDialogStore } from '@/views/index/tasks/stores'

defineOptions({ name: 'ProjectSmartList' })

const projectStore = useProjectStore()
const tasksDialogStore = useTasksDialogStore()

const { smartListData: projects } = storeToRefs(projectStore)
</script>
