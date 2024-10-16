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
                        <li class="nue-dropdown-item" data-executeid="archive">归档该清单</li>
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
import { handleUpdatePreference, archiveProjectWithConfirm } from '@/utils/project-handlers'
import { projectViewContextKey } from './constants'
import type { Project } from '@/stores'
import type { ProjectViewContext } from './types'

const route = useRoute()
const router = useRouter()
const todoStore = useTodoStore()
const projectStore = useProjectStore()

let firstLoadFlag: string | null = null
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
        const projectId = project.value?.id as string
        switch (executeId) {
            case 'save-as-preference':
                await handleSaveAsPreference(projectId)
                break
            case 'archive':
                await archiveProjectWithConfirm(projectId)
                router.replace({ name: 'tasks-all' })
                break
        }
    } catch (e) {
        console.warn(e)
    }
}

const handleLoadProjectPreference = () => {
    if (!project.value) return
    const projectPreference = project.value.preference || { viewType: 'table' }
    if (projectPreference) todoStore.resetOptions()
    Object.assign(projectPreference, {
        filterInfo: {
            isDeleted: false,
            projectId: project.value.id
        }
    })
    todoStore.setOptionsByProjectPreference(projectPreference)
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
    const firstLoadId = `${pid}|${name as string}` as string
    if (firstLoadFlag === firstLoadId && meta.category === 'project') return
    if (project.value) {
        document.title = 'NaoTodo - ' + project.value.title
        handleLoadProjectPreference()
    }
    firstLoadFlag = firstLoadId
})

provide<ProjectViewContext>(projectViewContextKey, { project })
</script>
