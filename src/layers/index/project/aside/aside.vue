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
                                    {{ projects.length }} items
                                </nue-text>
                            </nue-div>
                        </template>
                    </nue-button>
                    <nue-button
                        theme="pure"
                        icon="plus"
                        @click.stop="dialogData.visible = true"
                    ></nue-button>
                </template>
                <nue-link
                    theme="btnlike"
                    v-for="project in projects"
                    :key="project.id"
                    :route="{ name: 'project-main', params: { projectId: project.id } }"
                >
                    {{ project.name }}
                </nue-link>
            </nue-collapse-item>
        </nue-collapse>

        <!-- Add project dialog -->
        <nue-dialog
            v-model="dialogData.visible"
            title="Create new project"
            @confirm="handleAddProject"
        >
            <nue-div vertical align="stretch">
                <nue-input
                    v-model="dialogData.projectName"
                    title="Project name"
                    placeholder="Project name (required)"
                ></nue-input>
                <nue-textarea
                    v-model="dialogData.projectDescription"
                    title="Project description"
                    placeholder="Project description"
                    :rows="4"
                    autosize
                ></nue-textarea>
            </nue-div>
            <template #footer="{ cancel, confirm }">
                <nue-button @click.stop="cancel">Cancel</nue-button>
                <nue-button theme="primary" @click.stop="confirm">Create</nue-button>
            </template>
        </nue-dialog>
    </nue-div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useProjectStore, type Project } from '@/stores/use-project-store'
import { NueMessage, NuePrompt } from 'nue-ui'
import { storeToRefs } from 'pinia'

const emit = defineEmits<{
    (event: 'addProject', payload: Project): void
}>()

const projectStore = useProjectStore()

const { projects } = storeToRefs(projectStore)
const collapseItemsRecord = ref(['projects'])
const dialogData = reactive({
    visible: false,
    projectName: '',
    projectDescription: ''
})

async function handleAddProject() {
    await projectStore.createProject({
        name: dialogData.projectName,
        description: dialogData.projectDescription
    })
}
</script>
