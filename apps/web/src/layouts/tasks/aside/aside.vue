<script setup lang="ts">
import { computed, ref } from 'vue'
import useTasksViewStore from '@/views/tasks/tasks-view-store'
import ProjectSmartList from './smartlists/project-smart-list.vue'
import FilterSmartList from './smartlists/filter-smart-list.vue'
import TagSmartList from './smartlists/tag-smart-list.vue'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TasksAside' })

const { builtInProjects } = storeToRefs(useTasksViewStore())

const builtInProjectLinks = computed(() => {
    return builtInProjects.value.map((project) => ({
        id: project.id,
        title: project.name,
        route: { name: 'tasks-project', params: { projectId: project.id } },
        icon: project.icon
    }))
})

const collapseItemsRecord = ref(['projects', 'filters', 'tags'])
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
                <project-smart-list />
                <filter-smart-list />
                <tag-smart-list />
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
