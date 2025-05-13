<template>
    <smart-list
        collapse-item-name="projects"
        name="清单"
        manage-btn-tooltip="管理所有清单"
        create-btn-tooltip="创建新的清单"
        empty-text="用清单来分类收集、组织和管理你的待办任务"
        :links="links"
        @manage="handleManage"
        @create="handleCreate"
    />
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useProjectStore } from '@/stores'
import { useTasksDialogStore, useTasksHandlerStore } from '../../../stores'
import { computed } from 'vue'
import SmartList from './smart-list.vue'
import type { SmartListLinkVO } from './types'

const projectStore = useProjectStore()
const tasksDialogStore = useTasksDialogStore()
const tasksHandlerStore = useTasksHandlerStore()

const { smartListData: projects } = storeToRefs(projectStore)

const links = computed<SmartListLinkVO[]>(() => {
    return projects.value.map((project) => {
        return {
            id: project.id,
            title: project.title,
            route: { name: 'tasks-project', params: { projectId: project.id } },
            icon: 'more2'
        } as SmartListLinkVO
    })
})

const handleManage = () => {
    tasksDialogStore.dialogManagerShow('ProjectManager', {
        dialogSize: 'large'
    })
}

const handleCreate = () => {
    tasksDialogStore.dialogManagerShow('ProjectCreator', {
        useFooter: true,
        confirmHandler: tasksHandlerStore.handleCreateProject,
        dialogSize: 'small'
    })
}
</script>
