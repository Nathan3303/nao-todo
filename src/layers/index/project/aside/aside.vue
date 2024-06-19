<template>
    <nue-div class="app-aside" vertical align="stretch" flex>
        <!-- Mainly links -->
        <nue-div vertical gap="8px" align="stretch">
            <nue-link theme="btnlike" icon="board" :route="{ name: 'project-dashboard' }">
                Dashboard
            </nue-link>
        </nue-div>

        <!-- Category collapse -->
        <nue-collapse v-model="collapseItemsRecord">
            <!-- Projects collapse -->
            <nue-collapse-item name="projects" title="Projects" @add="handleAddProject">
                <template #header="{ collapse, state }">
                    <nue-button
                        theme="pure"
                        :icon="state ? 'arrow-right' : 'arrow-down'"
                        @click="collapse"
                    >
                        <template #default>
                            <nue-div>
                                <nue-text size="12px">Projects</nue-text>
                                <nue-text size="12px" color="gray">
                                    {{ projectStore.projects.length }} items
                                </nue-text>
                            </nue-div>
                        </template>
                    </nue-button>
                    <nue-button
                        theme="pure"
                        icon="plus"
                        @click.stop="handleAddProject"
                    ></nue-button>
                </template>
                <nue-link
                    theme="btnlike"
                    v-for="(p, idx) in projectStore.projects"
                    :key="idx"
                    :route="{ name: 'project-main', params: { projectId: p.id } }"
                >
                    {{ p.name }}
                </nue-link>
            </nue-collapse-item>
        </nue-collapse>
    </nue-div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '@/stores/useProjectStore'
import { NueMessage, NuePrompt } from 'nue-ui'

const projectStore = useProjectStore()

const collapseItemsRecord = ref(['projects'])

projectStore.read()

function handleAddProject() {
    NuePrompt({
        title: 'Create new project',
        placeholder: 'Input project name here...',
        confirmButtonText: 'Create',
        cancelButtonText: 'Cancel',
        validator: (value: any) => value
    }).then((value: any) => {
        projectStore.create(value as string, 'This project has no description yet.').then(
            () => NueMessage.success('Created new project successfully'),
            (err) => NueMessage.error(err)
        )
    })
}
</script>
