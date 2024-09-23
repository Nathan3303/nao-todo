<template>
    <nue-container class="tasks-project-view tasks-sub-view">
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
                    任务列表
                </nue-link>
                <nue-link theme="btnlike" :route="{ name: 'tasks-project-kanban' }">
                    任务看板
                </nue-link>
            </template>
        </todo-view-header>
        <nue-main>
            <router-view></router-view>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { computed, provide, ref, watch, watchEffect } from 'vue'
import { TodoViewHeader } from '@/layers'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore, useTodoStore } from '@/stores'
import { handleUpdatePreference } from '@/utils/project-handlers'
import { TasksProjectViewContextKey } from './constants'
import type { Project } from '@/stores'
import type { TasksProjectViewContext } from './types'

const props = defineProps<{ projectId: Project['id'] }>()

const route = useRoute()
const router = useRouter()
const todoStore = useTodoStore()
const projectStore = useProjectStore()

const project = ref<Project>()

const getViewType = () => {
    const viewType = (route.name as string).split('-')[2]
    if (['table', 'kanban'].includes(viewType)) {
        return viewType as 'table' | 'kanban'
    }
    return 'table'
}

const handleSaveAsPreference = async (projectId: Project['id']) => {
    const viewType = getViewType()
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

const handleLoadProjectPreference = (project: Project | null) => {
    if (project?.preference) {
        todoStore.setOptionsByProjectPreference(project.preference)
    } else {
        todoStore.resetOptions()
        todoStore.filterInfo = { isDeleted: false, projectId: project?.id }
    }
}

provide<TasksProjectViewContext>(TasksProjectViewContextKey, {
    projectId: computed(() => props.projectId),
    project
})

watch(
    () => route.params.projectId as string,
    (newProjectId) => {
        const _project = projectStore._toFinded(newProjectId)
        document.title = 'NaoTodo - ' + _project?.title
        if (!_project) {
            router.replace({ name: 'tasks-all' })
        } else {
            router.replace({ name: `tasks-project-${_project.preference?.viewType || 'table'}` })
        }
        handleLoadProjectPreference(_project)
        project.value = _project || void 0
    },
    { immediate: true }
)
</script>
