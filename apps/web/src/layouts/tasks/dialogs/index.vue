<script setup lang="ts">
import {
    ProjectCreator,
    ProjectManager,
    TagCreator,
    TagColorUpdater,
    TagManager,
    TaskCreator
} from '@/components/tasks/dialogs'
import useDialogs from './use-dialogs'

defineOptions({ name: 'TasksViewDialogs' })

const {
    projectCreatorRegister,
    projectCreatorHandler,
    projects,
    projectManagerRegister,
    tagCreatorRegister,
    tagCreatorHandler,
    tags,
    tagManagerRegister,
    tagColorUpdaterRegister,
    tagColorGetter,
    tagColorUpdater,
    taskCreatorRegister,
    taskCreatorHandler
} = useDialogs()
</script>

<template>
    <project-creator @register="projectCreatorRegister" :creator="projectCreatorHandler" />
    <project-manager @register="projectManagerRegister" :projects="projects" />
    <tag-creator @register="tagCreatorRegister" :creatr-tag-handler="tagCreatorHandler" />
    <tag-manager @register="tagManagerRegister" :tags="tags" />
    <TagColorUpdater
        @register="tagColorUpdaterRegister"
        :tag-color-getter="tagColorGetter"
        :tag-color-updater="tagColorUpdater"
    />
    <task-creator @register="taskCreatorRegister" :create-task-handler="taskCreatorHandler" />
</template>
