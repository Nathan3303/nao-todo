<script setup lang="ts">
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { useProjectUseCase, useTagUseCase, useTaskUseCase, useUserUseCase } from '@/hooks'
import { useUserStore } from '@nao-todo/presentation-identity'
import { useTasksStore } from '@nao-todo/presentation/task'
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
    TagColorUpdaterDialog,
    useTagsStore
} from '@nao-todo/presentation/tag'
import {
    TaskCreatorDialog,
    TaskParentSelectorDialog,
    TaskReminderDialog
} from '@nao-todo/presentation/task'
import { UserRestoreDialog } from '@nao-todo/presentation-identity'
import { storeToRefs } from 'pinia'
import { inject } from 'vue'

defineOptions({ name: 'AppDialogAdapter' })

// 从上下文注入依赖（仅 UI 服务/总线；业务用例本地组装）
const { appDialogManager, appSubscriber } = inject(INDEX_VIEW_CONTEXT_KEY)!

// @stores
const projectsStore = useProjectsStore()
const tagsStore = useTagsStore()
const tasksStore = useTasksStore()
const userStore = useUserStore()

// @usecases 业务依赖本地组装（DI 入口）
const projectUseCase = useProjectUseCase(projectsStore)
const tagUseCase = useTagUseCase(tagsStore)
const taskUseCase = useTaskUseCase(tasksStore)
const userUseCase = useUserUseCase(userStore)

// 从 pinia 中获取项目和标签列表
const { avaliableProjects } = storeToRefs(projectsStore)
const { tags: avaliableTags } = storeToRefs(tagsStore)
</script>

<template>
    <task-creator-dialog
        :task-use-case="taskUseCase"
        :dialog-manager="appDialogManager"
        :subscriber="appSubscriber"
        :avaliable-projects="avaliableProjects"
        :avaliable-tags="avaliableTags"
        :load-projects="() => projectUseCase.loadProjects()"
        :load-tags="() => tagUseCase.loadTags()"
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
    <tag-color-updater-dialog
        :tag-use-case="tagUseCase"
        :dialog-manager="appDialogManager"
        :subscriber="appSubscriber"
    />
    <user-restore-dialog :user-use-case="userUseCase" :dialog-manager="appDialogManager" />
</template>