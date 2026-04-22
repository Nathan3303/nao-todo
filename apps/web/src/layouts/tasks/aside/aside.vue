<script setup lang="ts">
import projectSmartList from '@/components/tasks/smartlists/project-smart-list.vue'
import FilterSmartList from '@/components/tasks/smartlists/filter-smart-list.vue'
import TagSmartList from '@/components/tasks/smartlists/tag-smart-list.vue'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'
import type { NaoSmartListLinkVO } from '@nao-todo/components'
import { computed, inject, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { useBuiltInProjectsStore, useProjectsStore, useTagsStore } from '@/stores/tasks'

defineOptions({ name: 'TasksViewAside' })

// @context Tasksview 任务视图上下文
const tasksViewContext = inject<TasksViewContext>(TASKS_VIEW_CONTEXT_KEY)!

// @dataStores
const builtInProjectsStore = useBuiltInProjectsStore()
const projectsStore = useProjectsStore()
const tagsStore = useTagsStore()

// @presetStates
const { builtInProjects } = storeToRefs(builtInProjectsStore)
const { availableProjects: projects } = storeToRefs(projectsStore)
const { tags } = storeToRefs(tagsStore)

// @state 侧边栏折叠项记录
const collapseItemsRecord = ref(['projects', 'filters', 'tags'])

// @state 侧边栏内建清单路由按钮视图对象
const builtInProjectLinks = computed<NaoSmartListLinkVO[]>(() => {
    return builtInProjects.value.map((project) => ({
        id: project.id,
        title: project.name,
        route: { name: 'tasks-built-in-project', params: { projectId: project.id } },
        icon: project.icon
    }))
})

// @state 侧边栏清单路由按钮视图对象
const projectLinks = computed(() => {
    return projects.value.map((p) => ({
        id: p.id,
        title: p.name,
        route: { name: 'tasks-project', params: { projectId: p.id } },
        icon: p.icon || 'more2'
    }))
})

// @state 侧边栏标签路由按钮视图对象
const tagLinks = computed<NaoSmartListLinkVO[]>(() => {
    return [...tags.value.values()].map((tag) => ({
        id: tag.id,
        title: tag.name,
        route: { name: 'tasks-tag', params: { tagId: tag.id } },
        icon: 'tag',
        payload: { color: tag.color || 'default' }
    }))
})

// @method 打开对话框
const openDialog = (dialogName: string) => {
    tasksViewContext.dialogManager.openDialog(dialogName)
}
</script>

<template>
    <nue-aside theme="tasks-aside" v-bind="$attrs">
        <nue-div vertical>
            <nue-div vertical gap="0.25rem">
                <nue-link
                    v-for="link in builtInProjectLinks.slice(0, 5)"
                    :key="link.id"
                    :icon="link.icon"
                    :route="{ name: 'tasks-built-in-project', params: { projectId: link.id } }"
                    theme="route"
                >
                    {{ link.title }}
                </nue-link>
            </nue-div>
            <nue-divider />
            <nue-collapse theme="menu" v-model="collapseItemsRecord">
                <project-smart-list
                    :links="projectLinks"
                    @open-project-creator="() => openDialog('project-creator')"
                    @open-project-manager="() => openDialog('project-manager')"
                />
                <filter-smart-list />
                <tag-smart-list
                    :links="tagLinks"
                    @open-tag-creator="() => openDialog('tag-creator')"
                    @open-tag-manager="() => openDialog('tag-manager')"
                />
            </nue-collapse>
            <nue-divider />
            <nue-div vertical gap="0.25rem">
                <nue-link
                    v-for="link in builtInProjectLinks.slice(5, builtInProjectLinks.length)"
                    :key="link.id"
                    :icon="link.icon"
                    :route="{ name: 'tasks-built-in-project', params: { projectId: link.id } }"
                    theme="route"
                >
                    {{ link.title }}
                </nue-link>
            </nue-div>
        </nue-div>
    </nue-aside>
</template>

<style scoped>
.nue-aside.nue-aside--tasks-aside {
    display: flex;
    flex-direction: column;
    gap: 1rem;

    .nue-div--block {
        flex-direction: column;
        gap: 0.5rem;
    }

    .nue-collapse--menu {
        gap: 0;

        .nue-collapse-item {
            border: none;
        }
    }
}
</style>

