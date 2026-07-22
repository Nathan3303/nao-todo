<script setup lang="ts">
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import {
    ProjectCreatorDialog,
    ProjectManagerDialog,
    ProjectUpdaterDialog,
    useProjectsStore
} from '@nao-todo/presentation/project'
import {
    TagCreatorDialog,
    TagManagerDialog,
    TagUpdaterDialog,
    useTagsStore
} from '@nao-todo/presentation/tag'
import {
    TaskCreatorDialog,
    TaskParentSelectorDialog,
    TaskReminderDialog
} from '@nao-todo/presentation/task'
import { UserRestoreDialog } from '@nao-todo/presentation/user'
import { storeToRefs } from 'pinia'
import { inject } from 'vue'

defineOptions({ name: 'AppDialogAdapter' })

// 从上下文注入依赖
const { userUseCase, taskUseCase, projectUseCase, tagUseCase, appDialogManager, appSubscriber } =
    inject(INDEX_VIEW_CONTEXT_KEY)!

// 从 pinia 中获取项目和标签列表
const { avaliableProjects } = storeToRefs(useProjectsStore())
const { tags: avaliableTags } = storeToRefs(useTagsStore())
</script>

<template>
    <task-creator-dialog
        :task-use-case="taskUseCase"
        :dialog-manager="appDialogManager"
        :subscriber="appSubscriber"
        :avaliable-projects="avaliableProjects"
        :avaliable-tags="avaliableTags"
    />
    <task-parent-selector-dialog :task-use-case="taskUseCase" :dialog-manager="appDialogManager" />
    <task-reminder-dialog :task-use-case="taskUseCase" :dialog-manager="appDialogManager" />
    <project-creator-dialog :project-use-case="projectUseCase" :dialog-manager="appDialogManager" />
    <project-manager-dialog
        :project-use-case="projectUseCase"
        :dialog-manager="appDialogManager"
        :subscriber="appSubscriber"
    />
    <project-updater-dialog :project-use-case="projectUseCase" :dialog-manager="appDialogManager" />
    <tag-creator-dialog
        :tag-use-case="tagUseCase"
        :dialog-manager="appDialogManager"
        :subscriber="appSubscriber"
    />
    <tag-manager-dialog
        :tag-use-case="tagUseCase"
        :dialog-manager="appDialogManager"
        :subscriber="appSubscriber"
    />
    <tag-updater-dialog
        :tag-use-case="tagUseCase"
        :dialog-manager="appDialogManager"
        :subscriber="appSubscriber"
    />
    <user-restore-dialog :user-use-case="userUseCase" :dialog-manager="appDialogManager" />
</template>
