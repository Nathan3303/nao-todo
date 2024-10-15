<template>
    <nue-container id="tasks/project" theme="vertical,inner">
        <todo-view-header :title="project?.title" :project="project">
            <template #subTitle>
                {{ project?.description }}
            </template>
            <template #actions>
                <nue-dropdown
                    placement="bottom-end"
                    size="small"
                    @execute="handleDropdownExecute"
                    hide-on-click
                >
                    <template #default="{ clickTrigger }">
                        <nue-button theme="icon-only" icon="more" @click="clickTrigger" />
                    </template>
                    <template #dropdown>
                        <li class="nue-dropdown-item" data-executeid="save-as-preference">
                            将当前视图保存为偏好
                        </li>
                    </template>
                </nue-dropdown>
            </template>
            <template #navigations>
                <nue-link theme="btnlike" :route="{ name: 'tasks-project-table' }">
                    列表视图
                </nue-link>
                <nue-link theme="btnlike" :route="{ name: 'tasks-project-kanban' }">
                    看板视图
                </nue-link>
            </template>
        </todo-view-header>
        <nue-main style="border: none">
            <router-view></router-view>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { provide, ref, watchEffect } from 'vue'
import { TodoViewHeader } from '@/layers'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore, useTodoStore } from '@/stores'
import { handleUpdatePreference } from '@/utils/project-handlers'
import { projectViewContextKey } from './constants'
import type { Project } from '@/stores'
import type { ProjectViewContext } from './types'

defineProps<{ projectId: Project['id'] }>()

const route = useRoute()
const router = useRouter()
const todoStore = useTodoStore()
const projectStore = useProjectStore()

let projectIdTemp: string | null = null
const project = ref<Project | null>(null)

const handleSaveAsPreference = async (projectId: Project['id']) => {
    const viewType = ((route.name as string).split('-')[2] as 'table' | 'kanban') || 'table'
    const preference: Project['preference'] = {
        viewType,
        filterInfo: todoStore.filterInfo,
        sortInfo: todoStore.sortInfo,
        columns: todoStore.columnOptions
    }
    await handleUpdatePreference(projectId, preference)
}

const handleDropdownExecute = async (executeId: string) => {
    try {
        switch (executeId) {
            case 'save-as-preference':
                const projectId = project.value?.id as string
                await handleSaveAsPreference(projectId)
                break
        }
    } catch (e) {
        console.warn(e)
    }
}

const handleLoadProjectPreference = () => {
    if (!project.value) return
    const projectPreference = project.value.preference
    if (projectPreference) {
        todoStore.setOptionsByProjectPreference(projectPreference)
        return
    }
    todoStore.resetOptions()
    todoStore.filterInfo = { isDeleted: false, projectId: project.value.id }
}

const handleGoToDefaulView = () => {
    if (!project.value) {
        router.replace({ name: 'tasks-all' })
        return
    }
    router.replace({
        name: `tasks-project-${project.value.preference?.viewType || 'table'}`
    })
}

watchEffect(() => {
    const { meta, params, name } = route
    const pid = params.projectId as Project['id']
    project.value = projectStore._toFinded(pid)
    if (!['tasks-project-table', 'tasks-project-kanban'].includes(name as string)) {
        handleGoToDefaulView()
    }
    if (projectIdTemp === pid && meta.category === 'project') return
    if (project.value) {
        document.title = 'NaoTodo - ' + project.value.title
        handleLoadProjectPreference()
    }
    projectIdTemp = pid
})

provide<ProjectViewContext>(projectViewContextKey, { project })
</script>
