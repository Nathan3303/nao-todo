<template>
    <nue-div class="app-aside" vertical align="stretch" flex>
        <!-- Search input -->
        <!-- <nue-input class="search-input" v-model="searchText" placeholder="Search" icon="search" /> -->

        <!-- Mainly links -->
        <nue-div vertical gap="8px" align="stretch">
            <nue-link theme="btnlike" icon="mail" route="/inbox"> Inbox </nue-link>
            <nue-link theme="btnlike" icon="calendar" route="/myactivity"> My Activity </nue-link>
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
                    :route="`/project/${p.id}`"
                >
                    {{ p.name }}
                    <!-- <template #append>
                        <nue-dropdown align="right">
                            <template #default="{ switchVisible }">
                                <nue-icon
                                    name="more"
                                    size="16px"
                                    color="white"
                                    @click.stop="switchVisible"
                                ></nue-icon>
                            </template>
                            <template #dropdown>
                                <li data-executeid="delete">Delete project</li>
                            </template>
                        </nue-dropdown>
                    </template> -->
                </nue-link>
            </nue-collapse-item>
        </nue-collapse>

        <!-- Footer -->
        <!-- <nue-div vertical align="stretch" gap="8px" style="margin-top: auto">
            <link-button icon="help"> Help </link-button>
            <link-button icon="setting"> Settings </link-button>
        </nue-div> -->
    </nue-div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useProjectStore } from '@/stores/useProjectStore'
import { NueMessage, NuePrompt } from 'nue-ui'

const projectStore = useProjectStore()
projectStore.read()

const popupVisible = ref(false)
const newProject = reactive({ name: '', description: '' })
const collapseItemsRecord = ref(['projects'])

function handleAddProject() {
    NuePrompt({
        title: 'Create new project',
        placeholder: 'Input project name here...',
        confirmButtonText: 'Create',
        cancelButtonText: 'Cancel',
        validator: (value: any) => value
    }).then((value: any) => {
        newProject.name = value
        handleConfirmPopup()
    })
}

function handleConfirmPopup() {
    projectStore.create(newProject.name, newProject.description).then(
        () => {
            NueMessage({ message: 'Created new project successfully', type: 'success' })
            popupVisible.value = false
            setTimeout(() => {
                newProject.name = ''
                newProject.description = ''
            }, 300)
        },
        (err) => NueMessage({ message: err, type: 'error' })
    )
}
</script>
