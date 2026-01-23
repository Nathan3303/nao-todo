<script setup lang="ts">
import projectSmartList from '@/components/tasks/smartlists/project-smart-list.vue'
import FilterSmartList from '@/components/tasks/smartlists/filter-smart-list.vue'
import TagSmartList from '@/components/tasks/smartlists/tag-smart-list.vue'
import useAside from './aside'

defineOptions({ name: 'TasksAside' })

const { collapseItemsRecord, builtInProjectLinks, projectLinks, tagLinks, openDialog } = useAside()
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

