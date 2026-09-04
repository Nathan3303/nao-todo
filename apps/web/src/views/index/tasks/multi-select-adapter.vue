<script setup lang="ts">
import { computed, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { TaskHandler, useTasksStore, TaskMultiSelectPanel } from '@nao-todo/presentation/task'
import { useTaskUseCase } from '@/hooks'
import { useSubscriber } from '@nao-todo/shared'
import { MULTI_SELECT_CONTEXT_KEY } from './multi-select-context'

defineOptions({ name: 'TaskMultiSelectAdapter' })

// @usecase/总线 本地组装（DI 入口；不来自父视图上下文）
const taskUseCase = useTaskUseCase(useTasksStore())
const appSubscriber = useSubscriber()
const multiSelectCtx = inject(MULTI_SELECT_CONTEXT_KEY)!

// 批量操作专用操作器（静默单条提示，由面板统一汇总）
const batchTaskHandler = new TaskHandler(taskUseCase, appSubscriber)
batchTaskHandler.silent = true

const { avaliableProjects } = storeToRefs(useProjectsStore())
const { tags: avaliableTags } = storeToRefs(useTagsStore())

// @computed 面板显隐
const visible = computed({
    get: () => multiSelectCtx.isOpen.value,
    set: (value) => {
        if (!value) multiSelectCtx.closePanel()
    }
})

// @computed 已选任务 ID（解包上下文中的 ref，供模板使用）
const selectedIds = computed(() => multiSelectCtx.selectedIds.value)
</script>

<template>
    <task-multi-select-panel
        v-model="visible"
        :task-handler="batchTaskHandler"
        :projects="avaliableProjects"
        :tags="avaliableTags"
        :selected-ids="selectedIds"
        @cleared="multiSelectCtx.requestClear"
    />
</template>