<template>
    <todo-view-table
        :key="route.params.projectId.toString()"
        :filter-info="todoStore.filterInfo"
        base-route="tasks-project-table"
        :columns="todoStore.columnOptions"
        @create-todo="handleCreateTodo"
        @create-todo-by-dialog="handleCreateTodoByDialog"
    />
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { TodoViewTable } from '@/layers'
import { useRoute } from 'vue-router'
import { createTodoWithOptions } from '@/utils'
import { useProjectStore, useTagStore, useUserStore, useTodoStore } from '@/stores'
import { TasksProjectViewContextKey } from './constants'
import type { Project, Todo } from '@/stores'
import type { TodoCreateDialogArgs } from '@/components/todo/create-dialog/types'
import type { TasksProjectViewContext } from './types'

const route = useRoute()
const userStore = useUserStore()
const projectStore = useProjectStore()
const todoStore = useTodoStore()
const tagStore = useTagStore()

const _viewContext = inject<TasksProjectViewContext>(TasksProjectViewContextKey)

const project = computed(() => {
    if (_viewContext) {
        return _viewContext.project.value as Project
    } else {
        const projectId = route.params.projectId as string
        return projectStore._toFinded(projectId)
    }
})

const handleCreateTodo = async (todoName: Todo['name']) => {
    if (!project.value) return
    // console.log(project.value);
    const { id, title } = project.value
    await createTodoWithOptions(id, {
        name: todoName,
        project: { title: title || '' }
    })
}

const handleCreateTodoByDialog = async (caller: (args: TodoCreateDialogArgs) => void) => {
    if (!project.value) return
    const { id, title } = project.value
    const avalibleProjects = projectStore._toFiltered({ isDeleted: false, isArchived: false })
    console.log(avalibleProjects)
    caller({
        userId: userStore.user!.id,
        projects: avalibleProjects,
        tags: tagStore.tags,
        presetInfo: {
            projectId: id,
            project: { title: title || '' }
        }
    })
}
</script>
