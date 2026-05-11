<script setup lang="ts">
import {
    ProjectCreator,
    ProjectManager,
    ProjectUpdater,
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
    projectCreatorOpener,
    projectUpdaterRegister,
    projectUpdaterHandler,
    projectGetter,
    tagCreatorRegister,
    tagCreatorHandler,
    tags,
    tagManagerRegister,
    tagColorUpdaterRegister,
    tagColorGetter,
    tagColorUpdater,
    tagCreatorOpener,
    tagColorUpdaterOpener,
    taskCreatorRegister,
    taskCreatorHandler,
    subscriber
} = useDialogs()
</script>

<template>
    <project-creator @register="projectCreatorRegister" :creator="projectCreatorHandler" />
    <project-manager
        @register="projectManagerRegister"
        :projects="projects"
        :project-creator-opener="projectCreatorOpener"
    />
    <project-updater
        @register="projectUpdaterRegister"
        :project-getter="projectGetter"
        :updater="projectUpdaterHandler"
    />
    <tag-creator @register="tagCreatorRegister" :creatr-tag-handler="tagCreatorHandler" />
    <tag-manager
        @register="tagManagerRegister"
        :tags="tags"
        :tag-creator-opener="tagCreatorOpener"
        :tag-color-updater-opener="tagColorUpdaterOpener"
    />
    <TagColorUpdater
        @register="tagColorUpdaterRegister"
        :tag-color-getter="tagColorGetter"
        :tag-color-updater="tagColorUpdater"
    />
    <task-creator
        @register="taskCreatorRegister"
        :create-task-handler="taskCreatorHandler"
        :avaliable-projects="projects"
        :avaliable-tags="tags"
        :subscriber="subscriber"
    />
</template>

