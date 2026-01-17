<script setup lang="ts">
import { computed, ref } from 'vue'
import useTasksViewStore from '@/views/tasks/tasks-view-store'
import projectSmartList from '@/components/tasks/smartlists/project-smart-list.vue'
import FilterSmartList from '@/components/tasks/smartlists/filter-smart-list.vue'
import TagSmartList from '@/components/tasks/smartlists/tag-smart-list.vue'
import type { NaoSmartListLinkVO } from '@/components/ui'

defineOptions({ name: 'TasksAside' })

const tasksViewStore = useTasksViewStore()

const collapseItemsRecord = ref(['projects', 'filters', 'tags'])

const builtInProjectLinks = computed<NaoSmartListLinkVO[]>(() => {
    return tasksViewStore.builtInProjectApp.states.builtInProjects.map((project) => ({
        id: project.id,
        title: project.name,
        route: { name: 'tasks-built-in-project', params: { projectId: project.id } },
        icon: project.icon
    }))
})

const projectLinks = computed<NaoSmartListLinkVO[]>(() => {
    return tasksViewStore.projectApp.states.projects.map((p) => {
        return {
            id: p.id,
            title: p.name,
            route: { name: 'tasks-project', params: { projectId: p.id } },
            icon: p.icon || 'more2'
        }
    })
})

const tagLinks = computed<NaoSmartListLinkVO[]>(() => {
    return tasksViewStore.tagApp.states.tags.map((tag) => ({
        id: tag.id,
        title: tag.name,
        route: { name: 'tasks-tag', params: { tagId: tag.id } },
        icon: 'tag',
        payload: { color: tag.color || 'default' }
    }))
})
</script>

<template>
    <nue-aside theme="tasks-aside" v-bind="$attrs">
        <nue-div vertical>
            <nue-div vertical gap="0.5rem">
                <nue-link
                    v-for="link in builtInProjectLinks"
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
                    @open-project-creator="
                        () => tasksViewStore.dialogManager.openDialog('project-creator')
                    "
                    @open-project-manager="
                        () => tasksViewStore.dialogManager.openDialog('project-manager')
                    "
                />
                <filter-smart-list />
                <tag-smart-list
                    :links="tagLinks"
                    @open-tag-creator="() => tasksViewStore.dialogManager.openDialog('tag-creator')"
                    @open-tag-manager="() => tasksViewStore.dialogManager.openDialog('tag-manager')"
                />
            </nue-collapse>
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

