<script setup lang="ts">
import { useTasksDialogStore } from '@/stores/tasks'
import { ref, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import {
    ProjectCreator,
    ProjectManager,
    TagCreator,
    TagColorUpdater,
    TagManager,
    TodoCreator
} from '@/components/tasks/dialogs'

defineOptions({ name: 'TasksDialogManager' })

const tasksDialogStore = useTasksDialogStore()

const {
    projectCreator: pc,
    projectManager: pm,
    tagCreator: tc,
    tagManager: tm,
    tagColorUpdater: tcu,
    todoCreator: tc1
} = storeToRefs(tasksDialogStore)

const projectCreatorRef = ref<InstanceType<typeof ProjectCreator>>()
const projectManagerRef = ref<InstanceType<typeof ProjectManager>>()
const tagCreatorRef = ref<InstanceType<typeof TagCreator>>()
const tagManagerRef = ref<InstanceType<typeof TagManager>>()
const tagColorUpdaterRef = ref<InstanceType<typeof TagColorUpdater>>()
const todoCreatorRef = ref<InstanceType<typeof TodoCreator>>()

watchEffect(() => {
    if (projectCreatorRef.value) {
        pc.value = projectCreatorRef.value
    }
    if (projectManagerRef.value) {
        pm.value = projectManagerRef.value
    }
    if (tagCreatorRef.value) {
        tc.value = tagCreatorRef.value
    }
    if (tagManagerRef.value) {
        tm.value = tagManagerRef.value
    }
    if (tagColorUpdaterRef.value) {
        tcu.value = tagColorUpdaterRef.value
    }
    if (todoCreatorRef.value) {
        tc1.value = todoCreatorRef.value
    }
})
</script>

<template>
    <project-creator ref="projectCreatorRef" />
    <project-manager ref="projectManagerRef" />
    <tag-creator ref="tagCreatorRef" />
    <tag-manager ref="tagManagerRef" />
    <tag-color-updater ref="tagColorUpdaterRef" />
    <todo-creator ref="todoCreatorRef" />
</template>
