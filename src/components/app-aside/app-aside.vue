<template>
    <nue-div class="app-aside" vertical align="stretch" flex>
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
                </nue-link>
            </nue-collapse-item>
        </nue-collapse>
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
